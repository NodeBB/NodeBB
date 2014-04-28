"use strict";

var	nconf = require('nconf'),
	fs = require('fs'),
	pidFilePath = __dirname + '/pidfile',
	start = function() {
		var	fork = require('child_process').fork,
			// output = fs.openSync(__dirname + '/logs/output.log', 'a'),
			output = fs.createWriteStream(__dirname + '/logs/output.log', {
				flags: 'a',
				encoding: 'utf-8'
			}),
			nbb_start = function() {
				var	silent = nconf.get('daemon') !== false;

				if (timesStarted > 3) {
					console.log('\n[loader] Experienced three start attempts in 10 seconds, most likely an error on startup. Halting.');
					return nbb_stop();
				}

				timesStarted++;
				if (startTimer) {
					clearTimeout(startTimer);
				}
				startTimer = setTimeout(resetTimer, 1000*10);

				nbb = fork('./app', process.argv.slice(2), {
					env: {
						'NODE_ENV': process.env.NODE_ENV
					},
					silent: silent
				});


				if (silent) {
					nbb.stdout.pipe(output);
					nbb.stderr.pipe(output);
				}

				nbb.on('message', function(message) {
					if (message && typeof message === 'object' && message.action) {
						if (message.action === 'restart') {
							nbb_restart();
						} else if (message.action === 'ready' && silent) {
							// Output bind_address
							process.stdout.write('\nNodeBB listening on ' + message.bind_address + '\n\n');

							// Daemonize and record new pid
							require('daemon')({
								stdout: output
							});
							fs.writeFile(__dirname + '/pidfile', process.pid);
						}
					}
				});

				nbb.on('exit', function(code, signal) {
					if (code) {
						nbb_start();
					} else {
						nbb_stop();
					}
				});
			},
			nbb_stop = function() {
				if (startTimer) {
					clearTimeout(startTimer);
				}

				nbb.kill();
				if (fs.existsSync(pidFilePath)) {
					var	pid = parseInt(fs.readFileSync(pidFilePath, { encoding: 'utf-8' }), 10);
					if (process.pid === pid) {
						fs.unlinkSync(pidFilePath);
					}
				}
			},
			nbb_restart = function() {
				nbb.removeAllListeners('exit').on('exit', function() {
					nbb_start();
				});
				nbb.kill();
			},
			resetTimer = function() {
				clearTimeout(startTimer);
				timesStarted = 0;
			},
			timesStarted = 0,
			startTimer;

		process.on('SIGINT', nbb_stop);
		process.on('SIGTERM', nbb_stop);
		process.on('SIGHUP', nbb_restart);

		nbb_start();
	},
	nbb;

nconf.argv();

// Start the daemon!
if (nconf.get('daemon') !== false) {
	// Check for a still-active NodeBB process
	if (fs.existsSync(pidFilePath)) {
		try {
			var	pid = fs.readFileSync(pidFilePath, { encoding: 'utf-8' });
			process.kill(pid, 0);
			console.log('\n  Error: Another NodeBB is already running!');
			process.exit();
		} catch (e) {
			fs.unlinkSync(pidFilePath);
		}
	}

	start();
} else {
	start();
}
