'use strict';

var async = require('async');
var nconf = require('nconf');

var packageInstall = require('../meta/package-install');
var upgrade = require('../upgrade');
var build = require('../meta/build');
var db = require('../database');
var meta = require('../meta');
var upgradePlugins = require('./upgrade-plugins').upgradePlugins;

function upgradeEverything() {
	async.series([
		function (next) {
			packageInstall.updatePackageFile();
			packageInstall.preserveExtraneousPlugins();
			next();
		},
		function (next) {
			process.stdout.write('1. '.bold + 'Bringing base dependencies up to date... \n'.yellow);
			packageInstall.npmInstallProduction();
			db.init(next);
		},
		function (next) {
			process.stdout.write('OK\n'.green);
			process.stdout.write('2. '.bold + 'Checking installed plugins for updates... '.yellow);
			upgradePlugins(next);
		},
		function (next) {
			process.stdout.write('3. '.bold + 'Updating NodeBB data store schema...\n'.yellow);
			upgrade.run(next);
		},
		function (next) {
			process.stdout.write('4. '.bold + 'Rebuilding assets...\n'.yellow);
			build.buildAll(next);
		},
	], function (err) {
		if (err) {
			process.stdout.write('Error occurred during upgrade');
			throw err;
		}

		var message = 'NodeBB Upgrade Complete!';
		// some consoles will return undefined/zero columns, so just use 2 spaces in upgrade script if we can't get our column count
		var columns = process.stdout.columns;
		var spaces = columns ? new Array(Math.floor(columns / 2) - (message.length / 2) + 1).join(' ') : '  ';

		process.stdout.write('OK\n'.green);
		process.stdout.write('\n' + spaces + message.green.bold + '\n\n'.reset);

		process.exit();
	});
}

function runUpgrade(upgrades) {
	process.stdout.write('\nUpdating NodeBB data store schema...\n'.yellow);

	// disable mongo timeouts during upgrade
	nconf.set('mongo:options:socketTimeoutMS', 0);

	if (upgrades === true) {
		upgradeEverything();
		return;
	}

	async.series([
		db.init,
		meta.configs.init,
		async.apply(upgrade.runParticular, upgrades),
	], function (err) {
		if (err) {
			throw err;
		}

		process.exit(0);
	});
}

exports.upgrade = runUpgrade;
