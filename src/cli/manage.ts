'use strict';

import winston from 'winston';
import child from 'child_process';
import CliGraph from 'cli-graph';
import chalk from 'chalk';
import nconf from 'nconf';
import { build as metaBuild } from '../meta/build';
import db from '../database';
import plugins from '../plugins';
import events from '../events';
import analytics from '../analytics';
import * as reset from './reset';
import { pluginNamePattern, themeNamePattern, paths } from '../constants';
// @ts-ignore
import { version } from '../../../package.json';

export async function install(plugin, options?) {
	if (!options) {
		options = {};
	}
	try {
		await db.init();
		if (!pluginNamePattern.test(plugin)) {
			// Allow omission of `nodebb-plugin-`
			plugin = `nodebb-plugin-${plugin}`;
		}

		plugin = await plugins.autocomplete(plugin);

		const isInstalled = await plugins.isInstalled(plugin);
		if (isInstalled) {
			throw new Error('plugin already installed');
		}
		const nbbVersion =  require(paths.currentPackage).default.version;
		const suggested = await plugins.suggest(plugin, nbbVersion);
		if (!suggested.version) {
			if (!options.force) {
				throw new Error(suggested.message);
			}
			winston.warn(`${suggested.message} Proceeding with installation anyway due to force option being provided`);
			suggested.version = 'latest';
		}
		winston.info('Installing Plugin `%s@%s`', plugin, suggested.version);
		await plugins.toggleInstall(plugin, suggested.version);

		process.exit(0);
	} catch (err: any) {
		winston.error(`An error occurred during plugin installation\n${err.stack}`);
		process.exit(1);
	}
}

export async function activate(plugin) {
	if (themeNamePattern.test(plugin)) {
		await reset.reset({
			theme: plugin,
		});
		process.exit();
	}
	try {
		await db.init();
		if (!pluginNamePattern.test(plugin)) {
			// Allow omission of `nodebb-plugin-`
			plugin = `nodebb-plugin-${plugin}`;
		}

		plugin = await plugins.autocomplete(plugin);

		const isInstalled = await plugins.isInstalled(plugin);
		if (!isInstalled) {
			throw new Error('plugin not installed');
		}
		const isActive = await plugins.isActive(plugin);
		if (isActive) {
			winston.info('Plugin `%s` already active', plugin);
			process.exit(0);
		}
		if (nconf.get('plugins:active')) {
			winston.error('Cannot activate plugins while plugin state configuration is set, please change your active configuration (config.json, environmental variables or terminal arguments) instead');
			process.exit(1);
		}
		const numPlugins = await db.sortedSetCard('plugins:active');
		winston.info('Activating plugin `%s`', plugin);
		await db.sortedSetAdd('plugins:active', numPlugins, plugin);
		await events.log({
			type: 'plugin-activate',
			text: plugin,
		});

		process.exit(0);
	} catch (err: any) {
		winston.error(`An error occurred during plugin activation\n${err.stack}`);
		process.exit(1);
	}
}

export async function listPlugins() {
	await db.init();
	const installed = await plugins.showInstalled();
	const installedList = installed.map(plugin => plugin.name);
	const active = await plugins.getActive();
	// Merge the two sets, defer to plugins in  `installed` if already present
	const combined = installed.concat(active.reduce((memo, cur) => {
		if (!installedList.includes(cur)) {
			memo.push({
				id: cur,
				active: true,
				installed: false,
			});
		}

		return memo;
	}, []));

	// Alphabetical sort
	combined.sort((a, b) => (a.id > b.id ? 1 : -1));

	// Pretty output
	process.stdout.write('Active plugins:\n');
	combined.forEach((plugin) => {
		process.stdout.write(`\t* ${plugin.id}${plugin.version ? `@${plugin.version}` : ''} (`);
		process.stdout.write(plugin.installed ? chalk.green('installed') : chalk.red('not installed'));
		process.stdout.write(', ');
		process.stdout.write(plugin.active ? chalk.green('enabled') : chalk.yellow('disabled'));
		process.stdout.write(')\n');
	});

	process.exit();
}

export async function listEvents(count = 10) {
	await db.init();
	const eventData = await events.getEvents('', 0, count - 1);
	console.log(chalk.bold(`\nDisplaying last ${count} administrative events...`));
	eventData.forEach((event) => {
		console.log(`  * ${chalk.green(String(event.timestampISO))} ${chalk.yellow(String(event.type))}${event.text ? ` ${event.text}` : ''} (uid: ${event.uid ? event.uid : 0})`);
	});
	process.exit();
}

export async function info() {
	console.log('');
	console.log(`  version:  ${version}`);

	console.log(`  Node ver: ${process.version}`);
    // @ts-ignore
	const hash = childprocess.execSync('git rev-parse HEAD');
	console.log(`  git hash: ${hash}`);

	console.log(`  database: ${nconf.get('database')}`);

	await db.init();
	const info = await db.info(db.client);

	switch (nconf.get('database')) {
		case 'redis':
			console.log(`        version: ${info.redis_version}`);
			console.log(`        disk sync:  ${info.rdb_last_bgsave_status}`);
			break;

		case 'mongo':
			console.log(`        version: ${info.version}`);
			console.log(`        engine:  ${info.storageEngine}`);
			break;
		case 'postgres':
			console.log(`        version: ${info.version}`);
			console.log(`        uptime:  ${info.uptime}`);
			break;
	}

	const analyticsData = await analytics.getHourlyStatsForSet('analytics:pageviews', Date.now(), 24);
	const graph = new CliGraph({
		height: 12,
		width: 25,
		center: {
			x: 0,
			y: 11,
		},
	});
	const min = Math.min(...analyticsData);
	const max = Math.max(...analyticsData);

	analyticsData.forEach((point, idx) => {
		// @ts-ignore
		graph.addPoint(idx + 1, Math.round(point / max * 10));
	});

	console.log('');
	console.log(graph.toString());
	console.log(`Pageviews, last 24h (min: ${min}  max: ${max})`);
	process.exit();
}

export async function build(targets, options?) {
	try {
		await metaBuild(targets, options);
		process.exit(0);
	} catch (err: any) {
		winston.error(err.stack);
		process.exit(1);
	}
}
