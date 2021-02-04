'use strict';

const async = require('async');
const nconf = require('nconf');

const packageInstall = require('./package-install');
const upgrade = require('../upgrade');
const build = require('../meta/build');
const db = require('../database');
const { upgradePlugins } = require('./upgrade-plugins');

const steps = {
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
	tasks = tasks.map((key, i) => function (next) {
		process.stdout.write(`\n${(`${i + 1}. `).bold}${steps[key].message.yellow}`);
		return steps[key].handler((err) => {
			if (err) { return next(err); }
			next();
		});
	});

	async.series(tasks, (err) => {
		if (err) {
			console.error(`Error occurred during upgrade: ${err.stack}`);
			throw err;
		}

		const message = 'NodeBB Upgrade Complete!';
		// some consoles will return undefined/zero columns,
		// so just use 2 spaces in upgrade script if we can't get our column count
		const { columns } = process.stdout;
		const spaces = columns ? new Array(Math.floor(columns / 2) - (message.length / 2) + 1).join(' ') : '  ';

		console.log(`\n\n${spaces}${message.green.bold}${'\n'.reset}`);

		process.exit();
	});
}

function runUpgrade(upgrades, options) {
	console.log('\nUpdating NodeBB...'.cyan);
	options = options || {};
	// disable mongo timeouts during upgrade
	nconf.set('mongo:options:socketTimeoutMS', 0);

	if (upgrades === true) {
		let tasks = Object.keys(steps);
		if (options.package || options.install ||
				options.plugins || options.schema || options.build) {
			tasks = tasks.filter(key => options[key]);
		}
		runSteps(tasks);
		return;
	}

	async.series([
		db.init,
		require('../meta').configs.init,
		async function () {
			await upgrade.runParticular(upgrades);
		},
	], (err) => {
		if (err) {
			throw err;
		}

		process.exit(0);
	});
}

exports.upgrade = runUpgrade;
