'use strict';

const winston = require('winston');
const async = require('async');
const path = require('path');
const nconf = require('nconf');

const { install } = require('../../install/web');

function setup(initConfig) {
	const { paths } = require('../constants');
	const install = require('../install');
	const build = require('../meta/build');
	const prestart = require('../prestart');
	const pkg = require('../../package.json');

	winston.info('NodeBB Setup Triggered via Command Line');

	console.log(`\nWelcome to NodeBB v${pkg.version}!`);
	console.log('\nThis looks like a new installation, so you\'ll have to answer a few questions about your environment before we can proceed.');
	console.log('Press enter to accept the default setting (shown in brackets).');

	install.values = initConfig;

	async.series([
		async function () {
			return await install.setup();
		},
		function (next) {
			var configFile = paths.config;
			if (nconf.get('config')) {
				configFile = path.resolve(paths.baseDir, nconf.get('config'));
			}

			prestart.loadConfig(configFile);

			if (!nconf.get('skip-build')) {
				build.buildAll(next);
			} else {
				setImmediate(next);
			}
		},
	], function (err, data) {
		// Disregard build step data
		data = data[0];

		var separator = '     ';
		if (process.stdout.columns > 10) {
			for (var x = 0, cols = process.stdout.columns - 10; x < cols; x += 1) {
				separator += '=';
			}
		}
		console.log(`\n${separator}\n`);

		if (err) {
			winston.error(`There was a problem completing NodeBB setup\n${err.stack}`);
			throw err;
		} else {
			if (data.hasOwnProperty('password')) {
				console.log('An administrative user was automatically created for you:');
				console.log(`    Username: ${data.username}`);
				console.log(`    Password: ${data.password}`);
				console.log('');
			}
			console.log('NodeBB Setup Completed. Run "./nodebb start" to manually start your NodeBB server.');

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
