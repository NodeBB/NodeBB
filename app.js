/*
	NodeBB - A better forum platform for the modern web
	https://github.com/NodeBB/NodeBB/
	Copyright (C) 2013-2014  NodeBB Inc.

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

"use strict";
/*global require, global, process*/

var nconf = require('nconf');
nconf.argv().env();

var fs = require('fs'),
	os = require('os'),
	url = require('url'),
	async = require('async'),
	semver = require('semver'),
	winston = require('winston'),
	path = require('path'),
	cluster = require('cluster'),
	pkg = require('./package.json'),
	utils = require('./public/src/utils.js');


global.env = process.env.NODE_ENV || 'production';

winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
	colorize: true,
	timestamp: function() {
		var date = new Date();
		return date.getDate() + '/' + (date.getMonth() + 1) + ' ' + date.toTimeString().substr(0,5) + ' [' + global.process.pid + ']';
	},
	level: global.env === 'production' ? 'info' : 'verbose'
});

// TODO: remove once https://github.com/flatiron/winston/issues/280 is fixed
winston.err = function (err) {
	winston.error(err.stack);
};

if(os.platform() === 'linux') {
	require('child_process').exec('/usr/bin/which convert', function(err, stdout, stderr) {
		if(err || !stdout) {
			winston.warn('Couldn\'t find convert. Did you install imagemagick?');
		}
	});
}

if (!cluster.isWorker) {
	// If run using `node app`, log GNU copyright info along with server info
	winston.info('NodeBB v' + pkg.version + ' Copyright (C) 2013-2014 NodeBB Inc.');
	winston.info('This program comes with ABSOLUTELY NO WARRANTY.');
	winston.info('This is free software, and you are welcome to redistribute it under certain conditions.');
	winston.info('');
}

// Alternate configuration file support
var	configFile = path.join(__dirname, '/config.json'),
	configExists;

if (nconf.get('config')) {
	configFile = path.resolve(__dirname, nconf.get('config'));
}
configExists = fs.existsSync(configFile);

if (!nconf.get('setup') && !nconf.get('install') && !nconf.get('upgrade') && !nconf.get('reset') && configExists) {
	start();
} else if (nconf.get('setup') || nconf.get('install') || !configExists) {
	setup();
} else if (nconf.get('upgrade')) {
	upgrade();
} else if (nconf.get('reset')) {
	reset();
}

function loadConfig() {
	nconf.file({
		file: configFile
	});

	nconf.defaults({
		base_dir: __dirname,
		themes_path: path.join(__dirname, 'node_modules'),
		upload_url: nconf.get('relative_path') + '/uploads/',
		views_dir: path.join(__dirname, 'public/templates')
	});

	// Ensure themes_path is a full filepath
	nconf.set('themes_path', path.resolve(__dirname, nconf.get('themes_path')));
	nconf.set('core_templates_path', path.join(__dirname, 'src/views'));
	nconf.set('base_templates_path', path.join(nconf.get('themes_path'), 'nodebb-theme-vanilla/templates'));
}

function start() {
	loadConfig();

	// nconf defaults, if not set in config
	if (!nconf.get('upload_path')) nconf.set('upload_path', '/public/uploads');
	if (!nconf.get('bcrypt_rounds')) nconf.set('bcrypt_rounds', 12);
	// Parse out the relative_url and other goodies from the configured URL
	var urlObject = url.parse(nconf.get('url'));
	nconf.set('use_port', !!urlObject.port);
	nconf.set('relative_path', urlObject.pathname !== '/' ? urlObject.pathname : '');
	nconf.set('port', urlObject.port || nconf.get('port') || nconf.get('PORT') || 4567);

	if (!cluster.isWorker || process.env.cluster_setup === 'true') {
		winston.info('Time: %s', (new Date()).toString());
		winston.info('Initializing NodeBB v%s', pkg.version);
		winston.verbose('* using configuration stored in: %s', configFile);
	}

	if (cluster.isWorker && process.env.cluster_setup === 'true') {
		var host = nconf.get(nconf.get('database') + ':host'),
			storeLocation = host ? 'at ' + host + (host.indexOf('/') === -1 ? ':' + nconf.get(nconf.get('database') + ':port') : '') : '';

		winston.verbose('* using %s store %s', nconf.get('database'), storeLocation);
		winston.verbose('* using themes stored in: %s', nconf.get('themes_path'));
	}


	var webserver = require('./src/webserver');

	require('./src/database').init(function(err) {
		if (err) {
			winston.error(err.stack);
			process.exit();
		}
		var meta = require('./src/meta');
		meta.configs.init(function () {
			var templates = require('templates.js'),
				sockets = require('./src/socket.io'),
				plugins = require('./src/plugins'),
				upgrade = require('./src/upgrade');

			meta.themes.setupPaths();

			templates.setGlobal('relative_path', nconf.get('relative_path'));

			upgrade.check(function(schema_ok) {
				if (schema_ok || nconf.get('check-schema') === false) {
					webserver.init();
					sockets.init(webserver.server);

					if (cluster.isWorker && process.env.handle_jobs === 'true') {
						require('./src/notifications').init();
						require('./src/user').startJobs();
					}

					nconf.set('url', nconf.get('base_url') + (nconf.get('use_port') ? ':' + nconf.get('port') : '') + nconf.get('relative_path'));

					async.waterfall([
						async.apply(plugins.ready),
						async.apply(meta.templates.compile),
						async.apply(webserver.listen)
					], function(err) {
						if (err) {
							winston.error(err.stack);
							process.exit();
						}

						if (process.send) {
							process.send({
								action: 'ready'
							});
						}
					});

					process.on('SIGTERM', shutdown);
					process.on('SIGINT', shutdown);
					process.on('SIGHUP', restart);
					process.on('message', function(message) {
						switch(message.action) {
							case 'reload':
								meta.reload();
							break;
							case 'js-propagate':
								meta.js.cache = message.cache;
								meta.js.map = message.map;
								winston.verbose('[cluster] Client-side javascript and mapping propagated to worker %s', cluster.worker.id);
							break;
							case 'css-propagate':
								meta.css.cache = message.cache;
								meta.css.acpCache = message.acpCache;
								winston.verbose('[cluster] Stylesheets propagated to worker %s', cluster.worker.id);
							break;
						}
					});

					process.on('uncaughtException', function(err) {
						winston.error(err.stack);
						console.log(err.stack);

						meta.js.killMinifier();
						shutdown(1);
					});
				} else {
					winston.warn('Your NodeBB schema is out-of-date. Please run the following command to bring your dataset up to spec:');
					winston.warn('    ./nodebb upgrade');
					if (cluster.isWorker) {
						cluster.worker.kill();
					} else {
						process.exit();
					}
				}
			});
		});
	});
}

function setup() {
	loadConfig();

	if (nconf.get('setup')) {
		winston.info('NodeBB Setup Triggered via Command Line');
	} else {
		winston.warn('Configuration not found, starting NodeBB setup');
	}

	var install = require('./src/install');

	winston.info('Welcome to NodeBB!');
	winston.info('This looks like a new installation, so you\'ll have to answer a few questions about your environment before we can proceed.');
	winston.info('Press enter to accept the default setting (shown in brackets).');

	install.setup(function (err) {
		if (err) {
			winston.error('There was a problem completing NodeBB setup: ', err.message);
		} else {
			winston.info('NodeBB Setup Completed. Run \'./nodebb start\' to manually start your NodeBB server.');
		}

		process.exit();
	});
}

function upgrade() {
	loadConfig();

	require('./src/database').init(function(err) {
		if (err) {
			winston.error(err.stack);
			process.exit();
		}
		require('./src/meta').configs.init(function () {
			require('./src/upgrade').upgrade();
		});
	});
}

function reset() {
	loadConfig();

	require('./src/database').init(function(err) {
		if (err) {
			winston.error(err.message);
			process.exit();
		}

		if (nconf.get('themes')) {
			resetThemes();
		} else if (nconf.get('plugin')) {
			resetPlugin(nconf.get('plugin'));
		} else if (nconf.get('plugins')) {
			resetPlugins();
		} else if (nconf.get('widgets')) {
			resetWidgets();
		} else if (nconf.get('settings')) {
			resetSettings();
		} else if (nconf.get('all')) {
			require('async').series([resetWidgets, resetThemes, resetPlugins, resetSettings], function(err) {
				if (!err) {
					winston.info('[reset] Reset complete.');
				} else {
					winston.error('[reset] Errors were encountered while resetting your forum settings: %s', err.message);
				}
				process.exit();
			});
		} else {
			winston.warn('[reset] Nothing reset.');
			winston.info('Use ./nodebb reset {themes|plugins|widgets|settings|all}');
			winston.info(' or');
			winston.info('Use ./nodebb reset plugin="nodebb-plugin-pluginName"');
			process.exit();
		}
	});
}

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
		id: 'nodebb-theme-vanilla'
	}, function(err) {
		winston.info('[reset] Theme reset to Vanilla');
		if (typeof callback === 'function') {
			callback(err);
		} else {
			process.exit();
		}
	});
}

function resetPlugin(pluginId) {
	var db = require('./src/database');
	db.setRemove('plugins:active', pluginId, function(err, result) {
		if (err || result !== 1) {
			winston.error('[reset] Could not disable plugin: %s', pluginId);
			if (err) {
				winston.error('[reset] Encountered error: %s', err.message);
			} else {
				winston.info('[reset] Perhaps it has already been disabled?');
			}
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

function shutdown(code) {
	winston.info('[app] Shutdown (SIGTERM/SIGINT) Initialised.');
	require('./src/database').close();
	winston.info('[app] Database connection closed.');
	require('./src/webserver').server.close();
	winston.info('[app] Web server closed to connections.');

	winston.info('[app] Shutdown complete.');
	process.exit(code || 0);
}

function restart() {
	if (process.send) {
		winston.info('[app] Restarting...');
		process.send({
			action: 'restart'
		});
	} else {
		winston.error('[app] Could not restart server. Shutting down.');
		shutdown(1);
	}
}