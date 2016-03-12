'use strict';

var winston = require('winston');
var nconf = require('nconf');
var async = require('async');
var db = require('./database');

var Reset = {};


Reset.reset = function() {
	db.init(function(err) {
		if (err) {
			winston.error(err.message);
			process.exit();
		}

		if (nconf.get('t')) {
			if(nconf.get('t') === true) {
				resetThemes();
			} else {
				resetTheme(nconf.get('t'));
			}
		} else if (nconf.get('p')) {
			if (nconf.get('p') === true) {
				resetPlugins();
			} else {
				resetPlugin(nconf.get('p'));
			}
		} else if (nconf.get('w')) {
			resetWidgets();
		} else if (nconf.get('s')) {
			resetSettings();
		} else if (nconf.get('a')) {
			require('async').series([resetWidgets, resetThemes, resetPlugins, resetSettings], function(err) {
				if (!err) {
					winston.info('[reset] Reset complete.');
				} else {
					winston.error('[reset] Errors were encountered while resetting your forum settings: %s', err.message);
				}
				process.exit();
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
			process.exit();
		}
	});
};

function resetSettings(callback) {
	var meta = require('./meta');
	meta.configs.set('allowLocalLogin', 1, function(err) {
		winston.info('[reset] Settings reset to default');
		if (typeof callback === 'function') {
			callback(err);
		} else {
			process.exit();
		}
	});
}

function resetTheme(themeId) {
	var meta = require('./meta');
	var fs = require('fs');
	
	fs.access('node_modules/' + themeId + '/package.json', function(err, fd) {
		if (err) {
			winston.warn('[reset] Theme `%s` is not installed on this forum', themeId);
			process.exit();
		} else {
			meta.themes.set({
				type: 'local',
				id: themeId
			}, function(err) {
				winston.info('[reset] Theme reset to ' + themeId);
				process.exit();
			});		
		}
	});
}

function resetThemes(callback) {
	var meta = require('./meta');

	meta.themes.set({
		type: 'local',
		id: 'nodebb-theme-persona'
	}, function(err) {
		winston.info('[reset] Theme reset to Persona');
		if (typeof callback === 'function') {
			callback(err);
		} else {
			process.exit();
		}
	});
}

function resetPlugin(pluginId) {
	var active = false;

	async.waterfall([
		async.apply(db.isSortedSetMember, 'plugins:active', pluginId),
		function(isMember, next) {
			active = isMember;

			if (isMember) {
				db.sortedSetRemove('plugins:active', pluginId, next);
			} else {
				next();
			}
		}
	], function(err) {
		if (err) {
			winston.error('[reset] Could not disable plugin: %s encountered error %s', pluginId, err.message);
		} else {
			if (active) {
				winston.info('[reset] Plugin `%s` disabled', pluginId);
			} else {
				winston.warn('[reset] Plugin `%s` was not active on this forum', pluginId);
				winston.info('[reset] No action taken.');
			}
		}

		process.exit();
	});
}

function resetPlugins(callback) {
	db.delete('plugins:active', function(err) {
		winston.info('[reset] All Plugins De-activated');
		if (typeof callback === 'function') {
			callback(err);
		} else {
			process.exit();
		}
	});
}

function resetWidgets(callback) {
	require('./widgets').reset(function(err) {
		winston.info('[reset] All Widgets moved to Draft Zone');
		if (typeof callback === 'function') {
			callback(err);
		} else {
			process.exit();
		}
	});
}

module.exports = Reset;