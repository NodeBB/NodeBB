'use strict';

var fs = require('fs');
var childProcess = require('child_process');

var fork = require('../meta/debugFork');
var paths = require('./paths');

var dirname = paths.baseDir;

function getRunningPid(callback) {
	fs.readFile(paths.pidfile, {
		encoding: 'utf-8',
	}, function (err, pid) {
		if (err) {
			return callback(err);
		}

		pid = parseInt(pid, 10);

		try {
			process.kill(pid, 0);
			callback(null, pid);
		} catch (e) {
			callback(e);
		}
	});
}

function start(options) {
	if (options.dev) {
		process.env.NODE_ENV = 'development';
		fork(paths.loader, ['--no-daemon', '--no-silent'], {
			env: process.env,
			cwd: dirname,
			stdio: 'inherit',
		});
		return;
	}
	if (options.log) {
		process.stdout.write('\nStarting NodeBB with logging output\n'.bold);
		process.stdout.write('\nHit '.red + 'Ctrl-C '.bold + 'to exit'.red);

		process.stdout.write('\nThe NodeBB process will continue to run in the background');
		process.stdout.write('\nUse "' + './nodebb stop'.yellow + '" to stop the NodeBB server\n');
		process.stdout.write('\n\n'.reset);
	} else if (!options.silent) {
		process.stdout.write('\nStarting NodeBB\n'.bold);
		process.stdout.write('  "' + './nodebb stop'.yellow + '" to stop the NodeBB server\n');
		process.stdout.write('  "' + './nodebb log'.yellow + '" to view server output\n');
		process.stdout.write('  "' + './nodebb restart'.yellow + '" to restart NodeBB\n\n'.reset);
	}

	// Spawn a new NodeBB process
	fork(paths.loader, process.argv.slice(3), {
		env: process.env,
		cwd: dirname,
	});
	if (options.log) {
		childProcess.spawn('tail', ['-F', './logs/output.log'], {
			cwd: dirname,
			stdio: 'inherit',
		});
	}
}

function stop() {
	getRunningPid(function (err, pid) {
		if (!err) {
			process.kill(pid, 'SIGTERM');
			process.stdout.write('Stopping NodeBB. Goodbye!\n');
		} else {
			process.stdout.write('NodeBB is already stopped.\n');
		}
	});
}

function restart(options) {
	getRunningPid(function (err, pid) {
		if (!err) {
			process.stdout.write('\nRestarting NodeBB\n'.bold);
			process.kill(pid, 'SIGTERM');

			options.silent = true;
			start(options);
		} else {
			process.stdout.write('NodeBB could not be restarted, as a running instance could not be found.\n');
		}
	});
}

function status() {
	getRunningPid(function (err, pid) {
		if (!err) {
			process.stdout.write('\nNodeBB Running '.bold + '(pid '.cyan + pid.toString().cyan + ')\n'.cyan);
			process.stdout.write('\t"' + './nodebb stop'.yellow + '" to stop the NodeBB server\n');
			process.stdout.write('\t"' + './nodebb log'.yellow + '" to view server output\n');
			process.stdout.write('\t"' + './nodebb restart'.yellow + '" to restart NodeBB\n\n');
		} else {
			process.stdout.write('\nNodeBB is not running\n'.bold);
			process.stdout.write('\t"' + './nodebb start'.yellow + '" to launch the NodeBB server\n\n'.reset);
		}
	});
}

function log() {
	process.stdout.write('\nHit '.red + 'Ctrl-C '.bold + 'to exit'.red);
	process.stdout.write('\n\n'.reset);
	childProcess.spawn('tail', ['-F', './logs/output.log'], {
		cwd: dirname,
		stdio: 'inherit',
	});
}

exports.start = start;
exports.stop = stop;
exports.restart = restart;
exports.status = status;
exports.log = log;
