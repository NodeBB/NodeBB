'use strict';

var	nconf = require('nconf'),
	net = require('net'),
	fs = require('fs'),
	url = require('url'),
	path = require('path'),
	cluster = require('cluster'),
	async = require('async'),
	Random = require('random-js'),
	logrotate = require('logrotate-stream'),

	pkg = require('./package.json'),

	pidFilePath = __dirname + '/pidfile',
	output = logrotate({ file: __dirname + '/logs/output.log', size: '1m', keep: 3, compress: true }),
	silent = process.env.NODE_ENV !== 'development',
	numProcs,
	handles = {},
	handleIndex = 0,
	server,

	Loader = {
		timesStarted: 0,
		js: {
			cache: undefined,
			map: undefined
		},
		css: {
			cache: undefined,
			acpCache: undefined
		}
	},
	internals = {
	  workers: [],
	  seed: 0,
	  header: 'x-forwarded-for',
	  version: {
	    major: 0,
	    sub: 1.0
	  },
	  republishPacket: node96Republish,
	  sync: {
	    isSynced: false,
	    event: 'sticky-sessions:syn'
	  },
	  random: new Random(Random.engines.mt19937().autoSeed())

	};

Loader.init = function(callback) {
	cluster.setupMaster({
		exec: "app.js",
		silent: silent
	});
	Loader.primaryWorker = 1;

	if (silent) {
		console.log = function(value) {
			output.write(value + '\n');
		};
	}

	process.on('SIGHUP', Loader.restart);
	process.on('SIGUSR2', Loader.reload);
	process.on('SIGTERM', Loader.stop);
	callback();
};

Loader.displayStartupMessages = function(callback) {
	console.log('');
	console.log('NodeBB v' + pkg.version + ' Copyright (C) 2013-2014 NodeBB Inc.');
	console.log('This program comes with ABSOLUTELY NO WARRANTY.');
	console.log('This is free software, and you are welcome to redistribute it under certain conditions.');
	console.log('For the full license, please visit: http://www.gnu.org/copyleft/gpl.html');
	console.log('');
	callback();
};

Loader.addClusterEvents = function(callback) {
	cluster.on('fork', function(worker) {
		worker.on('message', function(message, msgData) {
			if (message && typeof message === 'object' && message.action) {
				var otherWorkers;

				switch (message.action) {
					case 'ready':
						if (Loader.js.cache) {
							worker.send({
								action: 'js-propagate',
								cache: Loader.js.cache,
								map: Loader.js.map,
								hash: Loader.js.hash
							});
						}

						if (Loader.css.cache) {
							worker.send({
								action: 'css-propagate',
								cache: Loader.css.cache,
								acpCache: Loader.css.acpCache,
								hash: Loader.css.hash
							});
						}
					break;
					case 'restart':
						console.log('[cluster] Restarting...');
						Loader.restart(function(err) {
							console.log('[cluster] Restarting...');
						});
					break;
					case 'reload':
						console.log('[cluster] Reloading...');
						Loader.reload();
					break;
					case 'js-propagate':
						Loader.js.cache = message.cache;
						Loader.js.map = message.map;
						Loader.js.hash = message.hash;

						Loader.notifyWorkers({
							action: 'js-propagate',
							cache: message.cache,
							map: message.map,
							hash: message.hash
						}, worker.id);
					break;
					case 'css-propagate':
						Loader.css.cache = message.cache;
						Loader.css.acpCache = message.acpCache;
						Loader.css.hash = message.hash;

						Loader.notifyWorkers({
							action: 'css-propagate',
							cache: message.cache,
							acpCache: message.acpCache,
							hash: message.hash
						}, worker.id);
					break;
					case 'listening':
						if (message.primary) {
							Loader.primaryWorker = parseInt(worker.id, 10);
						}
					break;
					case 'config:update':
						Loader.notifyWorkers(message);
					break;
				}
			}
		});
	});

	cluster.on('listening', function(worker) {
		console.log('[cluster] Child Process (' + worker.process.pid + ') listening for connections.');
	});

	cluster.on('exit', function(worker, code, signal) {
		if (code !== 0) {
			if (Loader.timesStarted < numProcs*3) {
				Loader.timesStarted++;
				if (Loader.crashTimer) {
					clearTimeout(Loader.crashTimer);
				}
				Loader.crashTimer = setTimeout(function() {
					Loader.timesStarted = 0;
				}, 10000);
			} else {
				console.log(numProcs*3 + ' restarts in 10 seconds, most likely an error on startup. Halting.');
				process.exit();
			}
		}

		console.log('[cluster] Child Process (' + worker.process.pid + ') has exited (code: ' + code + ', signal: ' + signal +')');
		if (!worker.suicide) {
			console.log('[cluster] Spinning up another process...');

			var wasPrimary = parseInt(worker.id, 10) === Loader.primaryWorker;
			forkWorker(wasPrimary);
		}
	});

	cluster.on('disconnect', function(worker) {
		console.log('[cluster] Child Process (' + worker.process.pid + ') has disconnected');
	});

	callback();
};

Loader.start = function(callback) {
	console.log('Clustering enabled: Spinning up ' + numProcs + ' process(es).\n');

	var version = process.version.substr(1);
	var index =version.indexOf('.');

	//Writing version to internals.version
	internals.version.sub = Number( version.substr( index + 1 ) );
	internals.version.major = Number( version.substr( 0, index ) );

	internals.header = nconf.get('proxy_header');

	for(var x=0; x<numProcs; ++x) {
		forkWorker(x === 0);
	}

	internals.seed = internals.random.integer(0x0, 0x80000000);

	var urlObject = url.parse(nconf.get('url'));
	var port = urlObject.port || nconf.get('port') || nconf.get('PORT') || 4567;
	var proxy = nconf.get('proxy');
	var connectionListener;	

	nconf.set('port', port);

	if( proxy )
		connectionListener = layer4HashBalancedConnectionListener;
	else
		connectionListener = layer3HashBalancedConnectionListener;

	server = net.createServer(connectionListener).listen(port);

	if (callback) {
		callback();
	}
};

/**
  * Access 'private' object _handle of file decriptor to republish the read packet.
  */ 
function node96Republish( fd, data )
{
  fd._handle.onread( new Buffer( data ), 0, data.length );
}


/**
  * Hash balanced layer 3 connection listener.
  */
function layer3HashBalancedConnectionListener(c) {

  c._handle.readStop();
  // Get int31 hash of ip
  var worker,
      ipHash = hash((c.remoteAddress || '').split(/\./g), internals.seed);

  clusterWorkers();
  // Pass connection to worker
  worker = internals.workers[ipHash % internals.workers.length];
  worker.send({ action: 'sticky-session:connection' }, c);
}

/**
  * Hash balanced layer 4 connection listener.
  *
  * The node is choosed randomly initial and gets hash balanced later in patchConnection.
  */
function layer4HashBalancedConnectionListener(c) {
  c._handle.readStop();
  // Get int31 hash of ip
  var worker;

  clusterWorkers();
  // Pass connection to worker
  worker = internals.workers[ internals.random.integer( 0, internals.workers.length - 1 ) ];
  worker.send( { action: 'sticky-session:sync' }, c);
}

/**
  * Hash balance on the real ip and send data + file decriptor to final node.
  */
function patchConnection( c, fd )
{
  // Get int31 hash of ip
  var worker,
      ipHash = hash((c.realIP || '').split(/\./g), internals.seed);

  clusterWorkers();
  // Pass connection to worker
  worker = internals.workers[ipHash % internals.workers.length];
  worker.send( { action: 'sticky-session:syncconnection', data: c.data }, fd );
}

function hash(ip, seed) {
  var hash = ip.reduce(function(r, num) {
    r += parseInt(num, 10);
    r %= 2147483648;
    r += (r << 10)
    r %= 2147483648;
    r ^= r >> 6;
    return r;
  }, seed);

  hash += hash << 3;
  hash %= 2147483648;
  hash ^= hash >> 11;
  hash += hash << 15;
  hash %= 2147483648;

  return hash >>> 0;
}

function forkWorker(isPrimary) {
	var worker = cluster.fork({
			cluster_setup: isPrimary,
			handle_jobs: isPrimary,
			proxy_header: internals.header
		}),
		output = logrotate({ file: __dirname + '/logs/output.log', size: '1m', keep: 3, compress: true });

	if (silent) {
		worker.process.stdout.pipe(output);
		worker.process.stderr.pipe(output);
	}

	worker.on('message', function(message, c) {
		if(!message)
			return;

		if(message.action === 'sticky-session:ack' )
		{
			patchConnection( message, c );
		}
		else if (message.action !== 'sticky-session:accept') {
			return;
		}

		var _handle = handles[message.handleIndex];

		if (_handle) {
			_handle.close();

			delete handles[message.handleIndex];
		}
	});
}

function workerIndex(ip, numProcs) {
	var s = '';
	for (var i = 0, _len = ip.length; i < _len; i++) {
		if (parseInt(ip[i], 10)) {
			s += ip[i];
		}
	}
	return Number(s) % numProcs || 0;
}

function clusterWorkers() {
	var o = 0;

	for( var i in cluster.workers )
	{
		internals.workers[o++] = cluster.workers[i];
	}
}

Loader.restart = function(callback) {
	console.log('[cluster] closing server');

	killWorkers();

	closeHandles();

	server.close(function() {
		console.log('[cluster] server closed');
		Loader.start();
	});
};

Loader.reload = function() {
	Object.keys(cluster.workers).forEach(function(worker_id) {
		cluster.workers[worker_id].send({
			action: 'reload'
		});
	});
};

Loader.stop = function() {
	killWorkers();

	// Clean up the pidfile
	fs.unlinkSync(__dirname + '/pidfile');

	server.close();
};

function killWorkers() {
	Object.keys(cluster.workers).forEach(function(id) {
		cluster.workers[id].kill();
	});
}

function closeHandles() {
	for(var h in handles) {
		var handle = handles[h];
		if (handle) {
			handle.close();
			delete handles[h];
		}
	}
}

Loader.notifyWorkers = function (msg, worker_id) {
	worker_id = parseInt(worker_id, 10);
	Object.keys(cluster.workers).forEach(function(id) {
		if (parseInt(id, 10) !== worker_id) {
			cluster.workers[id].send(msg);
		}
	});
};

nconf.argv().file({
	file: path.join(__dirname, '/config.json')
});

numProcs = nconf.get('cluster') || 1;
numProcs = (numProcs === true) ? require('os').cpus().length : numProcs;

if (nconf.get('daemon') !== false) {
	if (fs.existsSync(pidFilePath)) {
		try {
			var	pid = fs.readFileSync(pidFilePath, { encoding: 'utf-8' });
			process.kill(pid, 0);
			process.exit();
		} catch (e) {
			fs.unlinkSync(pidFilePath);
		}
	}

	require('daemon')();

	fs.writeFile(__dirname + '/pidfile', process.pid);
}

async.series([
	Loader.init,
	Loader.displayStartupMessages,
	Loader.addClusterEvents,
	Loader.start
], function(err) {
	if (err) {
		console.log('[loader] Error during startup: ' + err.message);
	}
});