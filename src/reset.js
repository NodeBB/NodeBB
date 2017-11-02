'use strict';

require('colors');
var path = require('path');
var winston = require('winston');
var nconf = require('nconf');
var async = require('async');
var db = require('./database');
var events = require('./events');

var Reset = {};

Reset.reset = function (callback) {
	db.init(function (err) {
		if (err) {
			winston.error(err);
			throw err;
		}

		if (nconf.get('t')) {
			var themeId = nconf.get('t');
			if (themeId === true) {
				resetThemes(callback);
			} else {
				if (themeId.indexOf('nodebb-') !== 0) {
					// Allow omission of `nodebb-theme-`
					themeId = 'nodebb-theme-' + themeId;
				}

				resetTheme(themeId, callback);
			}
		} else if (nconf.get('p')) {
			var pluginId = nconf.get('p');
			if (pluginId === true) {
				resetPlugins(callback);
			} else {
				if (pluginId.indexOf('nodebb-') !== 0) {
					// Allow omission of `nodebb-plugin-`
					pluginId = 'nodebb-plugin-' + pluginId;
				}

				resetPlugin(pluginId, callback);
			}
		} else if (nconf.get('w')) {
			resetWidgets(callback);
		} else if (nconf.get('s')) {
			resetSettings(callback);
		} else if (nconf.get('a')) {
			require('async').series([resetWidgets, resetThemes, resetPlugins, resetSettings], function (err) {
				if (!err) {
					winston.info('[reset] Reset complete.');
				} else {
					winston.error('[reset] Errors were encountered while resetting your forum settings: %s', err);
				}

				callback();
			});
		} else {
			process.stdout.write('\nNodeBB Reset\n'.bold);
			process.stdout.write('No arguments passed in, so nothing was reset.\n\n'.yellow);
			process.stdout.write('Use ./nodebb reset ' + '{-t|-p|-w|-s|-a}\n'.red);
			process.stdout.write('    -t\tthemes\n');
			process.stdout.write('    -p\tplugins\n');
			process.stdout.write('    -w\twidgets\n');
			process.stdout.write('    -s\tsettings\n');
			process.stdout.write('    -a\tall of the above\n');

			process.stdout.write('\nPlugin and theme reset flags (-p & -t) can take a single argument\n');
			process.stdout.write('    e.g. ./nodebb reset -p nodebb-plugin-mentions, ./nodebb reset -t nodebb-theme-persona\n');
			process.stdout.write('         Prefix is optional, e.g. ./nodebb reset -p markdown, ./nodebb reset -t persona\n');

			process.exit(0);
		}
	});
};

function resetSettings(callback) {
	var meta = require('./meta');
	meta.configs.set('allowLocalLogin', 1, function (err) {
		winston.info('[reset] Settings reset to default');
		callback(err);
	});
}

function resetTheme(themeId, callback) {
	var meta = require('./meta');
	var fs = require('fs');

	fs.access(path.join(__dirname, '../node_modules', themeId, 'package.json'), function (err) {
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
	var meta = require('./meta');

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
		require('./plugins').reload,
		require('./widgets').reset,
		function (next) {
			winston.info('[reset] All Widgets moved to Draft Zone');
			next();
		},
	], callback);
}

module.exports = Reset;
