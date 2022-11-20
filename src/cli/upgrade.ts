'use strict';

import nconf from 'nconf';
const chalk = require('chalk');

const packageInstall = require('./package-install');
const { upgradePlugins } = require('./upgrade-plugins');

const steps = {
	package: {
		message: 'Updating package.json file with defaults...',
		handler: function () {
			packageInstall.updatePackageFile();
			packageInstall.preserveExtraneousPlugins();
			(process as any).stdout.write(chalk.green('  OK\n'));
		},
	},
	install: {
		message: 'Bringing base dependencies up to date...',
		handler: function () {
			(process as any).stdout.write(chalk.green('  started\n'));
			packageInstall.installAll();
		},
	},
	plugins: {
		message: 'Checking installed plugins for updates...',
		handler: async function () {
			await require('../database').init();
			await upgradePlugins();
		},
	},
	schema: {
		message: 'Updating NodeBB data store schema...',
		handler: async function () {
			await require('../database').init();
			await require('../meta').configs.init();
			await require('../upgrade').run();
		},
	},
	build: {
		message: 'Rebuilding assets...',
		handler: async function () {
			await require('../meta/build').buildAll();
		},
	},
};

async function runSteps(tasks: Array<any>) {
	try {
		for (let i = 0; i < tasks.length; i++) {
			const step = (steps as any)[tasks[i]];
			if (step && step.message && step.handler) {
				(process as any).stdout.write(`\n${chalk.bold(`${i + 1}. `)}${chalk.yellow(step.message)}`);
				/* eslint-disable-next-line */
				await step.handler();
			}
		}
		const message = 'NodeBB Upgrade Complete!';
		// some consoles will return undefined/zero columns,
		// so just use 2 spaces in upgrade script if we can't get our column count
		const { columns } = (process as any).stdout;
		const spaces = columns ? new Array(Math.floor(columns / 2) - (message.length / 2) + 1).join(' ') : '  ';

		console.log(`\n\n${spaces}${chalk.green.bold(message)}\n`);

		(process as any).exit();
	} catch (err: any) {
		console.error(`Error occurred during upgrade: ${err.stack}`);
		throw err;
	}
}

async function runUpgrade(upgrades, options) {
	console.log(chalk.cyan('\nUpdating NodeBB...'));
	options = options || {};
	// disable mongo timeouts during upgrade
	nconf.set('mongo:options:socketTimeoutMS', 0);

	if (upgrades === true) {
		let tasks = Object.keys(steps);
		if (options.package || options.install ||
				options.plugins || options.schema || options.build) {
			tasks = tasks.filter(key => options[key]);
		}
		await runSteps(tasks);
		return;
	}

	await require('../database').init();
	await require('../meta').configs.init();
	await require('../upgrade').runParticular(upgrades);
	(process as any).exit(0);
}

export const upgrade = runUpgrade;
