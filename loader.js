"use strict";

var	nconf = require('nconf'),
	net = require('net'),
	fs = require('fs'),
	url = require('url'),
	path = require('path'),
	cluster = require('cluster'),
	async = require('async'),
	logrotate = require('logrotate-stream'),

	pkg = require('./package.json'),

	pidFilePath = __dirname + '/pidfile',
	output = logrotate({ file: __dirname + '/logs/output.log', size: '1m', keep: 3, compress: true }),
	silent = process.env.NODE_ENV !== 'development' ? true : false,
	numProcs,
	handles = {},
	handleIndex = 0,
	server,

	Loader = {
		timesStarted: 0,
		shutdown_queue: [],
		js: {
			cache: undefined,
			map: undefined
		},
		css: {
			cache: undefined,
			acpCache: undefined
		}
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
		worker.on('message', function(message) {
			if (message && typeof message === 'object' && message.action) {
				var otherWorkers;

				switch (message.action) {
					case 'ready':
						if (Loader.js.cache) {
							worker.send({
								action: 'js-propagate',
								cache: Loader.js.cache,
								map: Loader.js.map
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

						// Kill an instance in the shutdown queue
						var workerToKill = Loader.shutdown_queue.pop();
						if (workerToKill) {
							cluster.workers[workerToKill].kill();
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

						otherWorkers = Object.keys(cluster.workers).filter(function(worker_id) {
							return parseInt(worker_id, 10) !== parseInt(worker.id, 10);
						});

						otherWorkers.forEach(function(worker_id) {
							cluster.workers[worker_id].send({
								action: 'js-propagate',
								cache: message.cache,
								map: message.map
							});
						});
					break;
					case 'css-propagate':
						Loader.css.cache = message.cache;
						Loader.css.acpCache = message.acpCache;
						Loader.css.hash = message.hash;

						otherWorkers = Object.keys(cluster.workers).filter(function(worker_id) {
							return parseInt(worker_id, 10) !== parseInt(worker.id, 10);
						});

						otherWorkers.forEach(function(worker_id) {
							cluster.workers[worker_id].send({
								action: 'css-propagate',
								cache: message.cache,
								acpCache: message.acpCache
							});
						});
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
				});
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

	for(var x=0; x<numProcs; ++x) {
		forkWorker(x === 0);
	}

	var urlObject = url.parse(nconf.get('url'));
	var port = urlObject.port || nconf.get('port') || nconf.get('PORT') || 4567;
 	nconf.set('port', port);

	server = net.createServer(function(connection) {
		// remove this once node 0.12.x ships, see https://github.com/elad/node-cluster-socket.io/issues/4
		connection._handle.readStop();

		var workers = clusterWorkers();
		var worker = workers[workerIndex(connection.remoteAddress, numProcs)];

		if (worker) {
			handles[handleIndex] = connection._handle;

			worker.send({action: 'sticky-session:connection', handleIndex: handleIndex}, connection);
			handleIndex ++;
		} else {
			console.log('Cant find worker! Worker count : ' + workers.length);
		}

	}).listen(port);

	if (callback) {
		callback();
	}
};

function forkWorker(isPrimary) {
	var worker = cluster.fork({
			cluster_setup: isPrimary,
			handle_jobs: isPrimary
		}),
		output = logrotate({ file: __dirname + '/logs/output.log', size: '1m', keep: 3, compress: true });

	if (silent) {
		worker.process.stdout.pipe(output);
		worker.process.stderr.pipe(output);
	}

	worker.on('message', function(message) {
		if (!message || message.action !== 'sticky-session:accept') {
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
		if (ip[i] !== '.') {
			s += ip[i];
		}
	}
	return Number(s) % numProcs;
}

function clusterWorkers() {
	var workers = [];

	for(var i in cluster.workers) {
		workers.push(cluster.workers[i]);
	}

	return workers;
}

Loader.restart = function(callback) {
	// Slate existing workers for termination -- welcome to death row.
	Loader.shutdown_queue = Loader.shutdown_queue.concat(Object.keys(cluster.workers));
	Loader.start();
};

Loader.reload = function() {
	Object.keys(cluster.workers).forEach(function(worker_id) {
		cluster.workers[worker_id].send({
			action: 'reload'
		});
	});
};

Loader.stop = function() {
	Object.keys(cluster.workers).forEach(function(id) {
		// Gracefully close workers
		cluster.workers[id].kill();
	});

	// Clean up the pidfile
	fs.unlinkSync(__dirname + '/pidfile');

	server.close();
};

Loader.notifyWorkers = function (msg) {
	Object.keys(cluster.workers).forEach(function(id) {
		cluster.workers[id].send(msg);
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