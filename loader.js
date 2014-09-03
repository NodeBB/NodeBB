"use strict";

var	nconf = require('nconf'),
	fs = require('fs'),
	cluster = require('cluster'),
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

nconf.argv();

cluster.setupMaster({
	exec: "app.js",
	silent: false
});

for(var x=0;x<numCPUs;x++) {
	cluster.fork();
}

cluster.on('exit', function(worker, code, signal) {
	console.log('worker ' + worker.process.pid + ' died');
});

Object.keys(cluster.workers).forEach(function(id) {
	cluster.workers[id].on('message', function(message) {
		if (message && typeof message === 'object' && message.action) {
			switch (message.action) {
				case 'ready':
					cluster.workers[id].send('bind');
				break;
				// case 'restart':
				// 	nbb_restart();
				// break;
			}
		}
	});
});

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