'use strict';

require('colors');
var path = require('path');
var winston = require('winston');
var async = require('async');
var fs = require('fs');

var db = require('../database');
var events = require('../events');
var meta = require('../meta');
var plugins = require('../plugins');
var widgets = require('../widgets');
var privileges = require('../privileges');

var dirname = require('./paths').baseDir;

var themeNamePattern = /^(@.*?\/)?nodebb-theme-.*$/;
var pluginNamePattern = /^(@.*?\/)?nodebb-(theme|plugin|widget|rewards)-.*$/;

exports.reset = function (options, callback) {
	var map = {
		theme: function (next) {
			var themeId = options.theme;
			if (themeId === true) {
				resetThemes(next);
			} else {
				if (!themeNamePattern.test(themeId)) {
					// Allow omission of `nodebb-theme-`
					themeId = 'nodebb-theme-' + themeId;
				}

				resetTheme(themeId, next);
			}
		},
		plugin: function (next) {
			var pluginId = options.plugin;
			if (pluginId === true) {
				resetPlugins(next);
			} else {
				if (!pluginNamePattern.test(pluginId)) {
					// Allow omission of `nodebb-plugin-`
					pluginId = 'nodebb-plugin-' + pluginId;
				}

				resetPlugin(pluginId, next);
			}
		},
		widgets: resetWidgets,
		settings: resetSettings,
		all: function (next) {
			async.series([resetWidgets, resetThemes, resetPlugins, resetSettings], next);
		},
	};

	var tasks = Object.keys(map)
		.filter(function (x) { return options[x]; })
		.map(function (x) { return map[x]; });

	if (!tasks.length) {
		console.log([
			'No arguments passed in, so nothing was reset.\n'.yellow,
			'Use ./nodebb reset ' + '{-t|-p|-w|-s|-a}'.red,
			'    -t\tthemes',
			'    -p\tplugins',
			'    -w\twidgets',
			'    -s\tsettings',
			'    -a\tall of the above',
			'',
			'Plugin and theme reset flags (-p & -t) can take a single argument',
			'    e.g. ./nodebb reset -p nodebb-plugin-mentions, ./nodebb reset -t nodebb-theme-persona',
			'         Prefix is optional, e.g. ./nodebb reset -p markdown, ./nodebb reset -t persona',
		].join('\n'));

		process.exit(0);
	}

	async.series([db.init].concat(tasks), function (err) {
		if (err) {
			winston.error('[reset] Errors were encountered during reset', err);
			throw err;
		}

		winston.info('[reset] Reset complete');
		callback();
	});
};

function resetSettings(callback) {
	privileges.global.give(['local:login'], 'registered-users', function (err) {
		if (err) {
			return callback(err);
		}
		winston.info('[reset] registered-users given login privilege');
		winston.info('[reset] Settings reset to default');
		callback();
	});
}

function resetTheme(themeId, callback) {
	fs.access(path.join(dirname, 'node_modules', themeId, 'package.json'), function (err) {
		if (err) {
			winston.warn('[reset] Theme `%s` is not installed on this forum', themeId);
			callback(new Error('theme-not-found'));
		} else {
			meta.themes.set({
				type: 'local',
				id: themeId,
			}, function (err) {
				if (err) {
					winston.warn('[reset] Failed to reset theme to ' + themeId);
				} else {
					winston.info('[reset] Theme reset to ' + themeId);
				}

				callback();
			});
		}
	});
}

function resetThemes(callback) {
	meta.themes.set({
		type: 'local',
		id: 'nodebb-theme-persona',
	}, function (err) {
		winston.info('[reset] Theme reset to Persona');
		callback(err);
	});
}

function resetPlugin(pluginId, callback) {
	var active = false;

	async.waterfall([
		async.apply(db.isSortedSetMember, 'plugins:active', pluginId),
		function (isMember, next) {
			active = isMember;

			if (isMember) {
				db.sortedSetRemove('plugins:active', pluginId, next);
			} else {
				next();
			}
		},
		function (next) {
			events.log({
				type: 'plugin-deactivate',
				text: pluginId,
			}, next);
		},
	], function (err) {
		if (err) {
			winston.error('[reset] Could not disable plugin: %s encountered error %s', pluginId, err);
		} else if (active) {
			winston.info('[reset] Plugin `%s` disabled', pluginId);
		} else {
			winston.warn('[reset] Plugin `%s` was not active on this forum', pluginId);
			winston.info('[reset] No action taken.');
			err = new Error('plugin-not-active');
		}

		callback(err);
	});
}

function resetPlugins(callback) {
	db.delete('plugins:active', function (err) {
		winston.info('[reset] All Plugins De-activated');
		callback(err);
	});
}

function resetWidgets(callback) {
	async.waterfall([
		plugins.reload,
		widgets.reset,
		function (next) {
			winston.info('[reset] All Widgets moved to Draft Zone');
			next();
		},
	], callback);
}
