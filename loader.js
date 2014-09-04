"use strict";

var	nconf = require('nconf'),
	fs = require('fs'),
	cluster = require('cluster'),
	async = require('async'),
	numCPUs = require('os').cpus().length;

	/* TODO
	    * pidFile and reset timer
	    * logging
	    * restart signal from child
	    * minifier
	*/

	// pidFilePath = __dirname + '/pidfile',
	// output = fs.openSync(__dirname + '/logs/output.log', 'a'),
	// start = function() {
	// 	var	nbb_start = function(callback) {
	// 			if (timesStarted > 3) {
	// 				console.log('\n[loader] Experienced three start attempts in 10 seconds, most likely an error on startup. Halting.');
	// 				return nbb_stop();
	// 			}

	// 			timesStarted++;
	// 			if (startTimer) {
	// 				clearTimeout(startTimer);
	// 			}
	// 			startTimer = setTimeout(resetTimer, 1000*10);

	// 			if (nbb) {
	// 				nbbOld = nbb;
	// 			}

	// 			nbb = require('child_process').fork('./app', process.argv.slice(2), {
	// 				env: process.env
	// 			});

	// 			nbb.on('message', function(message) {
	// 				if (message && typeof message === 'object' && message.action) {
	// 					switch (message.action) {
	// 						case 'ready':
	// 							if (!callback) return nbb.send('bind');
	// 							callback();
	// 						break;
	// 						case 'restart':
	// 							nbb_restart();
	// 						break;
	// 					}
	// 				}
	// 			});

	// 			nbb.on('exit', function(code, signal) {
	// 				if (code) {
	// 					nbb_start();
	// 				} else {
	// 					nbb_stop();
	// 				}
	// 			});
	// 		},
	// 		nbb_stop = function() {
	// 			if (startTimer) {
	// 				clearTimeout(startTimer);
	// 			}

	// 			nbb.kill();
	// 			if (fs.existsSync(pidFilePath)) {
	// 				var	pid = parseInt(fs.readFileSync(pidFilePath, { encoding: 'utf-8' }), 10);
	// 				if (process.pid === pid) {
	// 					fs.unlinkSync(pidFilePath);
	// 				}
	// 			}
	// 		},
	// 		nbb_restart = function() {
	// 			nbb_start(function() {
	// 				nbbOld.removeAllListeners('exit').on('exit', function() {
	// 					nbb.send('bind');
	// 				});
	// 				nbbOld.kill();
	// 			});
	// 		},
	// 		resetTimer = function() {
	// 			clearTimeout(startTimer);
	// 			timesStarted = 0;
	// 		},
	// 		timesStarted = 0,
	// 		startTimer;

	// 	process.on('SIGINT', nbb_stop);
	// 	process.on('SIGTERM', nbb_stop);
	// 	process.on('SIGHUP', nbb_restart);

	// 	nbb_start();
	// },
	// nbb, nbbOld;

var Loader = {
	timesStarted: 0,
	shutdown_queue: []
};

Loader.init = function() {
	nconf.argv();

	cluster.setupMaster({
		exec: "app.js",
		silent: process.env.NODE_ENV !== 'development' ? true : false
	});

	cluster.on('fork', function(worker) {
		worker.on('message', function(message) {
			if (message && typeof message === 'object' && message.action) {
				switch (message.action) {
					case 'ready':
						console.log('[cluster] Child Process (' + worker.process.pid + ') listening for connections.');
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
				}
			}
		});
	});

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
				console.log(numCPUs*3, 'restarts in 10 seconds, most likely an error on startup. Halting.');
				process.exit();
			}
		}

		console.log('[cluster] Child Process (' + worker.process.pid + ') has exited (code: ' + code + ')');
		if (!worker.suicide) {
			console.log('[cluster] Spinning up another process...')
			cluster.fork();
		}
	});

	process.on('SIGHUP', Loader.restart);

	Loader.start();
	// fs.writeFile(__dirname + '/pidfile', process.pid);
};

Loader.start = function() {
	for(var x=0;x<numCPUs;x++) {
		// Only the first worker sets up templates/sounds/jobs/etc
		cluster.fork({ cluster_setup: x === 0 });
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

Loader.init();

// Start the daemon!
// if (nconf.get('daemon') !== false) {
// 	// Check for a still-active NodeBB process
// 	if (fs.existsSync(pidFilePath)) {
// 		try {
// 			var	pid = fs.readFileSync(pidFilePath, { encoding: 'utf-8' });
// 			process.kill(pid, 0);
// 			process.exit();
// 		} catch (e) {
// 			fs.unlinkSync(pidFilePath);
// 		}
// 	}

// 	// Daemonize and record new pid
// 	require('daemon')({
// 		stdout: output
// 	});
// 	fs.writeFile(__dirname + '/pidfile', process.pid);

// 	start();
// } else {
// 	start();
// }