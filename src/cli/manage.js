'use strict';

var async = require('async');
var winston = require('winston');
var childProcess = require('child_process');
var _ = require('lodash');

var build = require('../meta/build');
var db = require('../database');
var plugins = require('../plugins');
var events = require('../events');
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
	process.stdout.write(
		'\n\n  Build targets:\n' +
		('\n     ' + _.padEnd('Target', length + 2) + '  |  Aliases').green +
		'\n     ------------------------------------------------------\n'.blue +
		output + '\n\n'
	);
}

function activate(plugin) {
	if (plugin.startsWith('nodebb-theme-')) {
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
			if (!plugin.startsWith('nodebb-')) {
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
	async.waterfall([
		function (next) {
			var version = require('../../package.json').version;
			process.stdout.write('\n  version:  ' + version);

			process.stdout.write('\n  Node ver: ' + process.version);
			next();
		},
		function (next) {
			process.stdout.write('\n  git hash: ');
			childProcess.execSync('git rev-parse HEAD', {
				stdio: 'inherit',
			});
			next();
		},
		function (next) {
			var config = require('../../config.json');
			process.stdout.write('\n  database: ' + config.database);
			next();
		},
		db.init,
		function (next) {
			db.info(db.client, next);
		},
		function (info, next) {
			process.stdout.write('\n        version: ' + info.version);
			process.stdout.write('\n        engine:  ' + info.storageEngine);
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
