'use strict';

var async = require('async');
var winston = require('winston');
var childProcess = require('child_process');
var _ = require('lodash');
var CliGraph = require('cli-graph');

var build = require('../meta/build');
var db = require('../database');
var plugins = require('../plugins');
var events = require('../events');
var analytics = require('../analytics');
var reset = require('./reset');

function buildTargets() {
	var aliases = build.aliases;
	var length = 0;
	var output = Object.keys(aliases).map(function (name) {
		var arr = aliases[name];
		if (name.length > length) {
			length = name.length;
		}

		return [name, arr.join(', ')];
	}).map(function (tuple) {
		return '     ' + _.padEnd('"' + tuple[0] + '"', length + 2).magenta + '  |  ' + tuple[1];
	}).join('\n');
	console.log(
		'\n\n  Build targets:\n' +
		('\n     ' + _.padEnd('Target', length + 2) + '  |  Aliases').green +
		'\n     ------------------------------------------------------\n'.blue +
		output + '\n'
	);
}

var themeNamePattern = /^(@.*?\/)?nodebb-theme-.*$/;
var pluginNamePattern = /^(@.*?\/)?nodebb-(theme|plugin|widget|rewards)-.*$/;

function activate(plugin) {
	if (themeNamePattern.test(plugin)) {
		reset.reset({
			theme: plugin,
		}, function (err) {
			if (err) { throw err; }
			process.exit();
		});
		return;
	}

	async.waterfall([
		function (next) {
			db.init(next);
		},
		function (next) {
			if (!pluginNamePattern.test(plugin)) {
				// Allow omission of `nodebb-plugin-`
				plugin = 'nodebb-plugin-' + plugin;
			}
			plugins.isInstalled(plugin, next);
		},
		function (isInstalled, next) {
			if (!isInstalled) {
				return next(new Error('plugin not installed'));
			}

			winston.info('Activating plugin `%s`', plugin);
			db.sortedSetAdd('plugins:active', 0, plugin, next);
		},
		function (next) {
			events.log({
				type: 'plugin-activate',
				text: plugin,
			}, next);
		},
	], function (err) {
		if (err) {
			winston.error('An error occurred during plugin activation', err);
			throw err;
		}
		process.exit(0);
	});
}

function listPlugins() {
	async.waterfall([
		db.init,
		function (next) {
			db.getSortedSetRange('plugins:active', 0, -1, next);
		},
		function (plugins) {
			winston.info('Active plugins: \n\t - ' + plugins.join('\n\t - '));
			process.exit();
		},
	], function (err) {
		throw err;
	});
}

function listEvents() {
	async.series([
		db.init,
		events.output,
	]);
}

function info() {
	console.log('');
	async.waterfall([
		function (next) {
			var version = require('../../package.json').version;
			console.log('  version:  ' + version);

			console.log('  Node ver: ' + process.version);
			next();
		},
		function (next) {
			var hash = childProcess.execSync('git rev-parse HEAD');
			console.log('  git hash: ' + hash);
			next();
		},
		function (next) {
			var config = require('../../config.json');
			console.log('  database: ' + config.database);
			next();
		},
		db.init,
		function (next) {
			db.info(db.client, next);
		},
		function (info, next) {
			var config = require('../../config.json');

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

			next();
		},
		async.apply(analytics.getHourlyStatsForSet, 'analytics:pageviews', Date.now(), 24),
		function (data, next) {
			var graph = new CliGraph({
				height: 12,
				width: 25,
				center: {
					x: 0,
					y: 11,
				},
			});
			var min = Math.min(...data);
			var max = Math.max(...data);

			data.forEach(function (point, idx) {
				graph.addPoint(idx + 1, Math.round(point / max * 10));
			});

			console.log('');
			console.log(graph.toString());
			console.log('Pageviews, last 24h (min: ' + min + '  max: ' + max + ')');
			next();
		},
	], function (err) {
		if (err) { throw err; }
		process.exit();
	});
}

exports.build = build.build;
exports.buildTargets = buildTargets;
exports.activate = activate;
exports.listPlugins = listPlugins;
exports.listEvents = listEvents;
exports.info = info;
