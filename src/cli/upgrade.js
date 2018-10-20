'use strict';

var async = require('async');
var nconf = require('nconf');

var packageInstall = require('./package-install');
var upgrade = require('../upgrade');
var build = require('../meta/build');
var db = require('../database');
var upgradePlugins = require('./upgrade-plugins').upgradePlugins;

var steps = {
	package: {
		message: 'Updating package.json file with defaults...',
		handler: function (next) {
			packageInstall.updatePackageFile();
			packageInstall.preserveExtraneousPlugins();
			process.stdout.write('  OK\n'.green);
			next();
		},
	},
	install: {
		message: 'Bringing base dependencies up to date...',
		handler: function (next) {
			process.stdout.write('  started\n'.green);
			packageInstall.installAll();
			next();
		},
	},
	plugins: {
		message: 'Checking installed plugins for updates...',
		handler: function (next) {
			async.series([
				db.init,
				upgradePlugins,
			], next);
		},
	},
	schema: {
		message: 'Updating NodeBB data store schema...',
		handler: function (next) {
			async.series([
				db.init,
				require('../meta').configs.init,
				upgrade.run,
			], next);
		},
	},
	build: {
		message: 'Rebuilding assets...',
		handler: build.buildAll,
	},
};

function runSteps(tasks) {
	tasks = tasks.map(function (key, i) {
		return function (next) {
			process.stdout.write('\n' + ((i + 1) + '. ').bold + steps[key].message.yellow);
			return steps[key].handler(function (err) {
				if (err) { return next(err); }
				next();
			});
		};
	});

	async.series(tasks, function (err) {
		if (err) {
			console.error('Error occurred during upgrade: ' + err.stack);
			throw err;
		}

		var message = 'NodeBB Upgrade Complete!';
		// some consoles will return undefined/zero columns, so just use 2 spaces in upgrade script if we can't get our column count
		var columns = process.stdout.columns;
		var spaces = columns ? new Array(Math.floor(columns / 2) - (message.length / 2) + 1).join(' ') : '  ';

		console.log('\n\n' + spaces + message.green.bold + '\n'.reset);

		process.exit();
	});
}

function runUpgrade(upgrades, options) {
	console.log('\nUpdating NodeBB...'.cyan);
	options = options || {};
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
		require('../meta').configs.init,
		async.apply(upgrade.runParticular, upgrades),
	], function (err) {
		if (err) {
			throw err;
		}

		process.exit(0);
	});
}

exports.upgrade = runUpgrade;
