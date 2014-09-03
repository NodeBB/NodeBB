"use strict";

var	nconf = require('nconf'),
	fs = require('fs'),
	cluster = require('cluster'),
	async = require('async'),
	numCPUs = require('os').cpus().length;

	/* TODO
	    * pidFile and reset timer
	    * logging
	    * handling SIGHUP
	    * restart signal from child
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
	timesStarted: 0
};

Loader.init = function() {
	nconf.argv();

	cluster.setupMaster({
		exec: "app.js",
		silent: true
	});

	for(var x=0;x<numCPUs;x++) {
		// Only the first worker sets up templates/sounds/jobs/etc
		cluster.fork({ cluster_setup: x === 0 });
	}

	cluster.on('fork', function(worker) {
		worker.on('message', function(message) {
			if (message && typeof message === 'object' && message.action) {
				switch (message.action) {
					case 'ready':
						console.log('[cluster] Child Process (' + worker.process.pid + ') listening for connections.');
						worker.send('bind');
					break;
					case 'restart':
						console.log('[cluster] Restarting...');
						Loader.restart(function(err) {
							console.log('[cluster] Restarting...');
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
			} else {
				console.log(numCPUs*3, 'restarts in 10 seconds, most likely an error on startup. Halting.');
				process.exit();
			}
		}

		console.log('[cluster] Child Process (' + worker.process.pid + ') has exited (code: ' + code + ')');
		cluster.fork();
	});
};

Loader.restart = function(callback) {
	async.eachSeries(Object.keys(cluster.workers), function(id, next) {
		cluster.workers[id].kill();
		next();
	}, callback);
}

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