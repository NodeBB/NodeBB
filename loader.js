"use strict";

var	nconf = require('nconf'),
	fs = require('fs'),
	path = require('path'),
	cluster = require('cluster'),
	async = require('async'),
	logrotate = require('logrotate-stream'),
	pidFilePath = __dirname + '/pidfile',
	output = logrotate({ file: __dirname + '/logs/output.log', size: '1m', keep: 3, compress: true }),
	silent = process.env.NODE_ENV !== 'development' ? true : false,
	numCPUs,
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

Loader.init = function() {
	cluster.setupMaster({
		exec: "app.js",
		silent: silent
	});

	if (silent) {
		console.log = function(value) {
			output.write(value + '\n');
		};
	}

	cluster.on('fork', function(worker) {
		worker.on('message', function(message) {
			if (message && typeof message === 'object' && message.action) {
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
								acpCache: Loader.css.acpCache
							});
						}

						worker.send('bind');

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

						var otherWorkers = Object.keys(cluster.workers).filter(function(worker_id) {
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

						var otherWorkers = Object.keys(cluster.workers).filter(function(worker_id) {
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
					case 'user:connect':
					case 'user:disconnect':
					case 'config:update':
						notifyWorkers(message);
					break;
				}
			}
		});
	});

	cluster.on('listening', function(worker) {
		console.log('[cluster] Child Process (' + worker.process.pid + ') listening for connections.');
	});

	function notifyWorkers(msg) {
		Object.keys(cluster.workers).forEach(function(id) {
			cluster.workers[id].send(msg);
		});
	}

	cluster.on('exit', function(worker, code, signal) {
		if (code !== 0) {
			if (Loader.timesStarted < numCPUs*3) {
				Loader.timesStarted++;
				if (Loader.crashTimer) {
					clearTimeout(Loader.crashTimer);
				}
				Loader.crashTimer = setTimeout(function() {
					Loader.timesStarted = 0;
				});
			} else {
				console.log(numCPUs*3 + ' restarts in 10 seconds, most likely an error on startup. Halting.');
				process.exit();
			}
		}

		console.log('[cluster] Child Process (' + worker.process.pid + ') has exited (code: ' + code + ')');
		if (!worker.suicide) {
			console.log('[cluster] Spinning up another process...')

			var wasPrimary = parseInt(worker.id, 10) === Loader.primaryWorker;
			cluster.fork({
				handle_jobs: wasPrimary
			});
		}
	});

	process.on('SIGHUP', Loader.restart);

	Loader.start();
};

Loader.start = function() {
	var worker;

	Loader.primaryWorker = 1;

	for(var x=0;x<numCPUs;x++) {
		// Only the first worker sets up templates/sounds/jobs/etc
		worker = cluster.fork({
			cluster_setup: x === 0,
			handle_jobs: x === 0
		});

		// Logging
		if (silent) {
			worker.process.stdout.pipe(output);
		}
	}
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




nconf.argv().file({
	file: path.join(__dirname, '/config.json')
});

numCPUs = nconf.get('cluster') || 1;
numCPUs = (numCPUs === true) ? require('os').cpus().length : numCPUs;

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

Loader.init();