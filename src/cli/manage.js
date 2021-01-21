'use strict';

const winston = require('winston');
const childProcess = require('child_process');
const CliGraph = require('cli-graph');

const build = require('../meta/build');
const db = require('../database');
const plugins = require('../plugins');
const events = require('../events');
const analytics = require('../analytics');
const reset = require('./reset');
const { pluginNamePattern, themeNamePattern } = require('../constants');

async function activate(plugin) {
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
			plugin = 'nodebb-plugin-' + plugin;
		}
		const isInstalled = await plugins.isInstalled(plugin);
		if (!isInstalled) {
			throw new Error('plugin not installed');
		}
		const isActive = await plugins.isActive(plugin);
		if (isActive) {
			winston.info('Plugin `%s` already active', plugin);
			process.exit(0);
		}
		const numPlugins = await db.sortedSetCard('plugins:active');
		winston.info('Activating plugin `%s`', plugin);
		await db.sortedSetAdd('plugins:active', numPlugins, plugin);
		await events.log({
			type: 'plugin-activate',
			text: plugin,
		});
	} catch (err) {
		winston.error('An error occurred during plugin activation\n' + err.stack);
	}
	process.exit(0);
}

async function listPlugins() {
	await db.init();
	const installed = await plugins.showInstalled();
	const installedList = installed.map(plugin => plugin.name);
	const active = await db.getSortedSetRange('plugins:active', 0, -1);

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
		process.stdout.write('\t* ' + plugin.id + (plugin.version ? '@' + plugin.version : '') + ' (');
		process.stdout.write(plugin.installed ? 'installed'.green : 'not installed'.red);
		process.stdout.write(', ');
		process.stdout.write(plugin.active ? 'enabled'.green : 'disabled'.yellow);
		process.stdout.write(')\n');
	});

	process.exit();
}

async function listEvents(count) {
	await db.init();
	const eventData = await events.getEvents('', 0, (count || 10) - 1);
	console.log(('\nDisplaying last ' + count + ' administrative events...').bold);
	eventData.forEach(function (event) {
		console.log('  * ' + String(event.timestampISO).green + ' ' + String(event.type).yellow + (event.text ? ' ' + event.text : '') + ' (uid: '.reset + (event.uid ? event.uid : 0) + ')');
	});
	process.exit();
}

async function info() {
	console.log('');
	const version = require('../../package.json').version;
	console.log('  version:  ' + version);

	console.log('  Node ver: ' + process.version);

	const hash = childProcess.execSync('git rev-parse HEAD');
	console.log('  git hash: ' + hash);

	const config = require('../../config.json');
	console.log('  database: ' + config.database);

	await db.init();
	const info = await db.info(db.client);

	switch (config.database) {
		case 'redis':
			console.log('        version: ' + info.redis_version);
			console.log('        disk sync:  ' + info.rdb_last_bgsave_status);
			break;

		case 'mongo':
			console.log('        version: ' + info.version);
			console.log('        engine:  ' + info.storageEngine);
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

	analyticsData.forEach(function (point, idx) {
		graph.addPoint(idx + 1, Math.round(point / max * 10));
	});

	console.log('');
	console.log(graph.toString());
	console.log('Pageviews, last 24h (min: ' + min + '  max: ' + max + ')');
	process.exit();
}

async function buildWrapper(targets, options) {
	try {
		await build.build(targets, options);
		process.exit(0);
	} catch (err) {
		winston.error(err.stack);
		process.exit(1);
	}
}

exports.build = buildWrapper;
exports.activate = activate;
exports.listPlugins = listPlugins;
exports.listEvents = listEvents;
exports.info = info;
