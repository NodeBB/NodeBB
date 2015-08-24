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
nconf.argv().env('__');

var fs = require('fs'),
	os = require('os'),
	url = require('url'),
	async = require('async'),
	semver = require('semver'),
	winston = require('winston'),
	colors = require('colors'),
	path = require('path'),
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
	level: nconf.get('log-level') || (global.env === 'production' ? 'info' : 'verbose')
});

if(os.platform() === 'linux') {
	require('child_process').exec('/usr/bin/which convert', function(err, stdout, stderr) {
		if(err || !stdout) {
			winston.warn('Couldn\'t find convert. Did you install imagemagick?');
		}
	});
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
} else if (nconf.get('setup') || nconf.get('install')) {
	setup();
} else if (!configExists) {
	require('./install/web').install(nconf.get('port'));
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
		views_dir: path.join(__dirname, 'public/templates'),
		version: pkg.version
	});

	if (!nconf.get('isCluster')) {
		nconf.set('isPrimary', 'true');
		nconf.set('isCluster', 'false');
	}

	// Ensure themes_path is a full filepath
	nconf.set('themes_path', path.resolve(__dirname, nconf.get('themes_path')));
	nconf.set('core_templates_path', path.join(__dirname, 'src/views'));
	nconf.set('base_templates_path', path.join(nconf.get('themes_path'), 'nodebb-theme-vanilla/templates'));

	if (!process.send) {
		// If run using `node app`, log GNU copyright info along with server info
		winston.info('NodeBB v' + nconf.get('version') + ' Copyright (C) 2013-2014 NodeBB Inc.');
		winston.info('This program comes with ABSOLUTELY NO WARRANTY.');
		winston.info('This is free software, and you are welcome to redistribute it under certain conditions.');
		winston.info('');
	}
}

function start() {
	loadConfig();
	var db = require('./src/database');

	// nconf defaults, if not set in config
	if (!nconf.get('upload_path')) {
		nconf.set('upload_path', '/public/uploads');
	}
	// Parse out the relative_url and other goodies from the configured URL
	var urlObject = url.parse(nconf.get('url'));
	var relativePath = urlObject.pathname !== '/' ? urlObject.pathname : '';
	nconf.set('base_url', urlObject.protocol + '//' + urlObject.host);
	nconf.set('secure', urlObject.protocol === 'https');
	nconf.set('use_port', !!urlObject.port);
	nconf.set('relative_path', relativePath);
	nconf.set('port', urlObject.port || nconf.get('port') || nconf.get('PORT') || 4567);
	nconf.set('upload_url', '/uploads/');

	if (nconf.get('isPrimary') === 'true') {
		winston.info('Time: %s', (new Date()).toString());
		winston.info('Initializing NodeBB v%s', nconf.get('version'));
		winston.verbose('* using configuration stored in: %s', configFile);

		var host = nconf.get(nconf.get('database') + ':host'),
			storeLocation = host ? 'at ' + host + (host.indexOf('/') === -1 ? ':' + nconf.get(nconf.get('database') + ':port') : '') : '';

		winston.verbose('* using %s store %s', nconf.get('database'), storeLocation);
		winston.verbose('* using themes stored in: %s', nconf.get('themes_path'));
	}

	process.on('SIGTERM', shutdown);
	process.on('SIGINT', shutdown);
	process.on('SIGHUP', restart);
	process.on('message', function(message) {
		if (typeof message !== 'object') {
			return;
		}
		var meta = require('./src/meta');
		var emitter = require('./src/emitter');
		switch (message.action) {
			case 'reload':
				meta.reload();
			break;
			case 'js-propagate':
				meta.js.cache = message.cache;
				meta.js.map = message.map;
				meta.js.hash = message.hash;
				emitter.emit('meta:js.compiled');
				winston.verbose('[cluster] Client-side javascript and mapping propagated to worker %s', process.pid);
			break;
			case 'css-propagate':
				meta.css.cache = message.cache;
				meta.css.acpCache = message.acpCache;
				meta.css.hash = message.hash;
				emitter.emit('meta:css.compiled');
				winston.verbose('[cluster] Stylesheets propagated to worker %s', process.pid);
			break;
			case 'templates:compiled':
				emitter.emit('templates:compiled');
			break;
		}
	});

	process.on('uncaughtException', function(err) {
		winston.error(err.stack);
		console.log(err.stack);

		require('./src/meta').js.killMinifier();
		shutdown(1);
	});

	async.waterfall([
		async.apply(db.init),
		async.apply(db.checkCompatibility),
		function(next) {
			require('./src/meta').configs.init(next);
		},
		function(next) {
			require('./src/meta').dependencies.check(next);
		},
		function(next) {
			require('./src/upgrade').check(next);
		},
		function(next) {
			var webserver = require('./src/webserver');
			require('./src/socket.io').init(webserver.server);

			if (nconf.get('isPrimary') === 'true' && !nconf.get('jobsDisabled')) {
				require('./src/notifications').init();
				require('./src/user').startJobs();
			}

			webserver.listen();
		}
	], function(err) {
		if (err) {
			switch(err.message) {
				case 'schema-out-of-date':
					winston.warn('Your NodeBB schema is out-of-date. Please run the following command to bring your dataset up to spec:');
					winston.warn('    ./nodebb upgrade');
					break;
				case 'dependencies-out-of-date':
					winston.warn('One or more of NodeBB\'s dependent packages are out-of-date. Please run the following command to update them:');
					winston.warn('    ./nodebb upgrade');
					break;
				default:
					if (err.stacktrace !== false) {
						winston.error(err.stack);
					} else {
						winston.error(err.message);
					}
					break;
			}

			// Either way, bad stuff happened. Abort start.
			process.exit();
		}
	});
}

function setup() {
	loadConfig();

	winston.info('NodeBB Setup Triggered via Command Line');

	var install = require('./src/install');

	process.stdout.write('\nWelcome to NodeBB!\n');
	process.stdout.write('\nThis looks like a new installation, so you\'ll have to answer a few questions about your environment before we can proceed.\n');
	process.stdout.write('Press enter to accept the default setting (shown in brackets).\n');

	install.setup(function (err, data) {
		var separator = '     ';
		if (process.stdout.columns > 10) {
			for(var x=0,cols=process.stdout.columns-10;x<cols;x++) {
				separator += '=';
			}
		}
		process.stdout.write('\n' + separator + '\n\n');

		if (err) {
			winston.error('There was a problem completing NodeBB setup: ', err.message);
		} else {
			if (data.hasOwnProperty('password')) {
				process.stdout.write('An administrative user was automatically created for you:\n');
				process.stdout.write('    Username: ' + data.username + '\n');
				process.stdout.write('    Password: ' + data.password + '\n');
				process.stdout.write('\n');
			}
			process.stdout.write('NodeBB Setup Completed. Run \'./nodebb start\' to manually start your NodeBB server.\n');

			// If I am a child process, notify the parent of the returned data before exiting (useful for notifying
			// hosts of auto-generated username/password during headless setups)
			if (process.send) {
				process.send(data);
			}
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
