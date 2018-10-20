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
		console.log('\n' + [
			'Starting NodeBB with logging output'.bold,
			'Hit '.red + 'Ctrl-C '.bold + 'to exit'.red,
			'The NodeBB process will continue to run in the background',
			'Use "' + './nodebb stop'.yellow + '" to stop the NodeBB server',
		].join('\n'));
	} else if (!options.silent) {
		console.log('\n' + [
			'Starting NodeBB'.bold,
			'  "' + './nodebb stop'.yellow + '" to stop the NodeBB server',
			'  "' + './nodebb log'.yellow + '" to view server output',
			'  "' + './nodebb help'.yellow + '" for more commands\n'.reset,
		].join('\n'));
	}

	// Spawn a new NodeBB process
	var child = fork(paths.loader, process.argv.slice(3), {
		env: process.env,
		cwd: dirname,
	});
	if (options.log) {
		childProcess.spawn('tail', ['-F', './logs/output.log'], {
			cwd: dirname,
			stdio: 'inherit',
		});
	}

	return child;
}

function stop() {
	getRunningPid(function (err, pid) {
		if (!err) {
			process.kill(pid, 'SIGTERM');
			console.log('Stopping NodeBB. Goodbye!');
		} else {
			console.log('NodeBB is already stopped.');
		}
	});
}

function restart(options) {
	getRunningPid(function (err, pid) {
		if (!err) {
			console.log('\nRestarting NodeBB'.bold);
			process.kill(pid, 'SIGTERM');

			options.silent = true;
			start(options);
		} else {
			console.warn('NodeBB could not be restarted, as a running instance could not be found.');
		}
	});
}

function status() {
	getRunningPid(function (err, pid) {
		if (!err) {
			console.log('\n' + [
				'NodeBB Running '.bold + ('(pid ' + pid.toString() + ')').cyan,
				'\t"' + './nodebb stop'.yellow + '" to stop the NodeBB server',
				'\t"' + './nodebb log'.yellow + '" to view server output',
				'\t"' + './nodebb restart'.yellow + '" to restart NodeBB\n',
			].join('\n'));
		} else {
			console.log('\nNodeBB is not running'.bold);
			console.log('\t"' + './nodebb start'.yellow + '" to launch the NodeBB server\n'.reset);
		}
	});
}

function log() {
	console.log('\nHit '.red + 'Ctrl-C '.bold + 'to exit\n'.red + '\n'.reset);
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
