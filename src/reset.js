'use strict';

var winston = require('winston');
var nconf = require('nconf');

var Reset = {};


module.exports = Reset;

Reset.reset = function() {
	loadConfig();

	require('./src/database').init(function(err) {
		if (err) {
			winston.error(err.message);
			process.exit();
		}

		if (nconf.get('t')) {
			resetThemes();
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

			process.stdout.write('\nPlugin reset flag (-p) can take a single argument\n');
			process.stdout.write('    e.g. ./nodebb reset -p nodebb-plugin-mentions\n');
			process.exit();
		}
	});
};

function resetSettings(callback) {
	var meta = require('./src/meta');
	meta.configs.set('allowLocalLogin', 1, function(err) {
		winston.info('[reset] Settings reset to default');
		if (typeof callback === 'function') {
			callback(err);
		} else {
			process.exit();
		}
	});
}

function resetThemes(callback) {
	var meta = require('./src/meta');

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
	var db = require('./src/database');
	db.sortedSetRemove('plugins:active', pluginId, function(err) {
		if (err) {
			winston.error('[reset] Could not disable plugin: %s encountered error %s', pluginId, err.message);
		} else {
			winston.info('[reset] Plugin `%s` disabled', pluginId);
		}

		process.exit();
	});
}

function resetPlugins(callback) {
	var db = require('./src/database');
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
	require('./src/widgets').reset(function(err) {
		winston.info('[reset] All Widgets moved to Draft Zone');
		if (typeof callback === 'function') {
			callback(err);
		} else {
			process.exit();
		}
	});
}