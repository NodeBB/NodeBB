'use strict';

import winston from 'winston';
import child from 'child_process';
import CliGraph from 'cli-graph';
import chalk from 'chalk';
import nconf from 'nconf';
import { build } from '../meta/build';
import db from '../database';
import plugins from '../plugins';
import events from '../events';
import analytics from '../analytics';
import * as reset from './reset';
import { pluginNamePattern, themeNamePattern, paths } from '../constants';
//@ts-ignore
import { version } from '../../package.json';


async function install(plugin, options?) {
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

		(process as any).exit(0);
	} catch (err: any) {
		winston.error(`An error occurred during plugin installation\n${err.stack}`);
		(process as any).exit(1);
	}
}

async function activate(plugin) {
	if (themeNamePattern.test(plugin)) {
		await reset.reset({
			theme: plugin,
		});
		(process as any).exit();
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
			(process as any).exit(0);
		}
		if (nconf.get('plugins:active')) {
			winston.error('Cannot activate plugins while plugin state configuration is set, please change your active configuration (config.json, environmental variables or terminal arguments) instead');
			(process as any).exit(1);
		}
		const numPlugins = await db.sortedSetCard('plugins:active');
		winston.info('Activating plugin `%s`', plugin);
		await db.sortedSetAdd('plugins:active', numPlugins, plugin);
		await events.log({
			type: 'plugin-activate',
			text: plugin,
		});

		(process as any).exit(0);
	} catch (err: any) {
		winston.error(`An error occurred during plugin activation\n${err.stack}`);
		(process as any).exit(1);
	}
}

async function listPlugins() {
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
	(process as any).stdout.write('Active plugins:\n');
	combined.forEach((plugin) => {
		(process as any).stdout.write(`\t* ${plugin.id}${plugin.version ? `@${plugin.version}` : ''} (`);
		(process as any).stdout.write(plugin.installed ? chalk.green('installed') : chalk.red('not installed'));
		(process as any).stdout.write(', ');
		(process as any).stdout.write(plugin.active ? chalk.green('enabled') : chalk.yellow('disabled'));
		(process as any).stdout.write(')\n');
	});

	(process as any).exit();
}

async function listEvents(count = 10) {
	await db.init();
	const eventData = await events.getEvents('', 0, count - 1);
	console.log(chalk.bold(`\nDisplaying last ${count} administrative events...`));
	eventData.forEach((event) => {
		console.log(`  * ${chalk.green(String(event.timestampISO))} ${chalk.yellow(String(event.type))}${event.text ? ` ${event.text}` : ''} (uid: ${event.uid ? event.uid : 0})`);
	});
	(process as any).exit();
}

async function info() {
	console.log('');
	console.log(`  version:  ${version}`);

	console.log(`  Node ver: ${(process as any).version}`);
    // @ts-ignore
	const hash = child(process as any).execSync('git rev-parse HEAD');
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
	(process as any).exit();
}

async function buildWrapper(targets, options?) {
	try {
		await build(targets, options);
		(process as any).exit(0);
	} catch (err: any) {
		winston.error(err.stack);
		(process as any).exit(1);
	}
}

export default {
	buildWrapper,
	install,
	activate,
	listPlugins,
	listEvents,
	info
};