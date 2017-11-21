'use strict';

var async = require('async');
var nconf = require('nconf');

var packageInstall = require('../meta/package-install');
var upgrade = require('../upgrade');
var build = require('../meta/build');
var db = require('../database');
var meta = require('../meta');
var upgradePlugins = require('./upgrade-plugins').upgradePlugins;

var steps = {
	package: function (next) {
		process.stdout.write('Updating package.json file with defaults... \n'.yellow);
		packageInstall.updatePackageFile();
		packageInstall.preserveExtraneousPlugins();
		process.stdout.write('OK\n'.green);
		next();
	},
	install: function (next) {
		process.stdout.write('Bringing base dependencies up to date... \n'.yellow);
		packageInstall.npmInstallProduction();
		process.stdout.write('OK\n'.green);
		next();
	},
	plugins: function (next) {
		process.stdout.write('Checking installed plugins for updates... \n'.yellow);
		async.series([
			db.init,
			upgradePlugins,
			function (next) {
				process.stdout.write('OK\n'.green);
				next();
			},
		], next);
	},
	schema: function (next) {
		process.stdout.write('Updating NodeBB data store schema...\n'.yellow);
		async.series([
			db.init,
			upgrade.run,
			function (next) {
				process.stdout.write('OK\n'.green);
				next();
			},
		], next);
	},
	build: function (next) {
		process.stdout.write('Rebuilding assets...\n'.yellow);
		async.series([
			build.buildAll,
			function (next) {
				process.stdout.write('OK\n'.green);
				next();
			},
		], next);
	},
};

function runSteps(tasks) {
	tasks = tasks.map(function (key, i) {
		return function (next) {
			process.stdout.write(((i + 1) + '. ').bold);
			return steps[key](next);
		};
	});

	async.series(tasks, function (err) {
		if (err) {
			process.stdout.write('Error occurred during upgrade');
			throw err;
		}

		var message = 'NodeBB Upgrade Complete!';
		// some consoles will return undefined/zero columns, so just use 2 spaces in upgrade script if we can't get our column count
		var columns = process.stdout.columns;
		var spaces = columns ? new Array(Math.floor(columns / 2) - (message.length / 2) + 1).join(' ') : '  ';

		process.stdout.write('\n' + spaces + message.green.bold + '\n\n'.reset);

		process.exit();
	});
}

function runUpgrade(upgrades, options) {
	process.stdout.write('\nUpdating NodeBB...\n'.cyan);

	// disable mongo timeouts during upgrade
	nconf.set('mongo:options:socketTimeoutMS', 0);

	if (upgrades === true) {
		var tasks = Object.keys(steps);
		if (options.package || options.install ||
				options.plugins || options.schema || options.build) {
			tasks = tasks.filter(function (key) {
				return options[key];
			});
		}
		runSteps(tasks);
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
