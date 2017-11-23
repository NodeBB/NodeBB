'use strict';

var winston = require('winston');
var async = require('async');

var install = require('../../install/web').install;

function setup() {
	var install = require('../install');
	var build = require('../meta/build');
	var prestart = require('../prestart');

	winston.info('NodeBB Setup Triggered via Command Line');

	process.stdout.write('\nWelcome to NodeBB!\n');
	process.stdout.write('\nThis looks like a new installation, so you\'ll have to answer a few questions about your environment before we can proceed.\n');
	process.stdout.write('Press enter to accept the default setting (shown in brackets).\n');

	async.series([
		install.setup,
		prestart.loadConfig,
		build.buildAll,
	], function (err, data) {
		// Disregard build step data
		data = data[0];

		var separator = '     ';
		if (process.stdout.columns > 10) {
			for (var x = 0, cols = process.stdout.columns - 10; x < cols; x += 1) {
				separator += '=';
			}
		}
		process.stdout.write('\n' + separator + '\n\n');

		if (err) {
			winston.error('There was a problem completing NodeBB setup', err);
			throw err;
		} else {
			if (data.hasOwnProperty('password')) {
				process.stdout.write('An administrative user was automatically created for you:\n');
				process.stdout.write('    Username: ' + data.username + '\n');
				process.stdout.write('    Password: ' + data.password + '\n');
				process.stdout.write('\n');
			}
			process.stdout.write('NodeBB Setup Completed. Run \'./nodebb start\' to manually start your NodeBB server.\n');

			// If I am a child process, notify the parent of the returned data before exiting (useful for notifying
			// hosts of auto-generated username/password during headless setups)
			if (process.send) {
				process.send(data);
			}
		}

		process.exit();
	});
}

exports.setup = setup;
exports.webInstall = install;
