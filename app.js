/*
	NodeBB - A better forum platform for the modern web
	https://github.com/NodeBB/NodeBB/
	Copyright (C) 2013-2016  NodeBB Inc.

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

var url = require('url');
var async = require('async');
var winston = require('winston');
var path = require('path');
var pkg = require('./package.json');
var file = require('./src/file');

global.env = process.env.NODE_ENV || 'production';

winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
	colorize: true,
	timestamp: function () {
		var date = new Date();
		return (!!nconf.get('json-logging')) ? date.toJSON() :	date.getDate() + '/' + (date.getMonth() + 1) + ' ' + date.toTimeString().substr(0,8) + ' [' + global.process.pid + ']';
	},
	level: nconf.get('log-level') || (global.env === 'production' ? 'info' : 'verbose'),
	json: (!!nconf.get('json-logging')),
	stringify: (!!nconf.get('json-logging'))
});


// Alternate configuration file support
var	configFile = path.join(__dirname, '/config.json');

if (nconf.get('config')) {
	configFile = path.resolve(__dirname, nconf.get('config'));
}

var configExists = file.existsSync(configFile) || (nconf.get('url') && nconf.get('secret') && nconf.get('database'));

loadConfig();
versionCheck();

if (!process.send) {
	// If run using `node app`, log GNU copyright info along with server info
	winston.info('NodeBB v' + nconf.get('version') + ' Copyright (C) 2013-' + (new Date()).getFullYear() + ' NodeBB Inc.');
	winston.info('This program comes with ABSOLUTELY NO WARRANTY.');
	winston.info('This is free software, and you are welcome to redistribute it under certain conditions.');
	winston.info('');
}


if (nconf.get('setup') || nconf.get('install')) {
	setup();
} else if (!configExists) {
	require('./install/web').install(nconf.get('port'));
} else if (nconf.get('upgrade')) {
	upgrade();
} else if (nconf.get('reset')) {
	async.waterfall([
		async.apply(require('./src/reset').reset),
		async.apply(require('./build').buildAll)
	], function (err) {
		process.exit(err ? 1 : 0);
	});
} else if (nconf.get('activate')) {
	activate();
} else if (nconf.get('plugins')) {
	listPlugins();
} else if (nconf.get('build')) {
	require('./build').build(nconf.get('build'));
} else {
	start();
}

function loadConfig(callback) {
	winston.verbose('* using configuration stored in: %s', configFile);

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
	nconf.set('base_templates_path', path.join(nconf.get('themes_path'), 'nodebb-theme-persona/templates'));

	if (nconf.get('url')) {
		nconf.set('url_parsed', url.parse(nconf.get('url')));
	}

	if (typeof callback === 'function') {
		callback();
	}
}


function start() {
	var db = require('./src/database');

	// nconf defaults, if not set in config
	if (!nconf.get('upload_path')) {
		nconf.set('upload_path', '/public/uploads');
	}
	if (!nconf.get('sessionKey')) {
		nconf.set('sessionKey', 'express.sid');
	}
	// Parse out the relative_url and other goodies from the configured URL
	var urlObject = url.parse(nconf.get('url'));
	var relativePath = urlObject.pathname !== '/' ? urlObject.pathname : '';
	nconf.set('base_url', urlObject.protocol + '//' + urlObject.host);
	nconf.set('secure', urlObject.protocol === 'https:');
	nconf.set('use_port', !!urlObject.port);
	nconf.set('relative_path', relativePath);
	nconf.set('port', urlObject.port || nconf.get('port') || nconf.get('PORT') || (nconf.get('PORT_ENV_VAR') ? nconf.get(nconf.get('PORT_ENV_VAR')) : false) || 4567);
	nconf.set('upload_url', nconf.get('upload_path').replace(/^\/public/, ''));

	if (nconf.get('isPrimary') === 'true') {
		winston.info('Time: %s', (new Date()).toString());
		winston.info('Initializing NodeBB v%s', nconf.get('version'));


		var host = nconf.get(nconf.get('database') + ':host'),
			storeLocation = host ? 'at ' + host + (host.indexOf('/') === -1 ? ':' + nconf.get(nconf.get('database') + ':port') : '') : '';

		winston.verbose('* using %s store %s', nconf.get('database'), storeLocation);
		winston.verbose('* using themes stored in: %s', nconf.get('themes_path'));
	}

	process.on('SIGTERM', shutdown);
	process.on('SIGINT', shutdown);
	process.on('SIGHUP', restart);
	process.on('message', function (message) {
		if (typeof message !== 'object') {
			return;
		}
		var meta = require('./src/meta');

		switch (message.action) {
			case 'reload':
				meta.reload();
			break;
		}
	});

	process.on('uncaughtException', function (err) {
		winston.error(err.stack);
		console.log(err.stack);

		require('./src/meta').js.killMinifier();
		shutdown(1);
	});

	async.waterfall([
		async.apply(db.init),
		function (next) {
			var meta = require('./src/meta');
			async.parallel([
				async.apply(db.checkCompatibility),
				async.apply(meta.configs.init),
				function (next) {
					if (nconf.get('dep-check') === undefined || nconf.get('dep-check') !== false) {
						meta.dependencies.check(next);
					} else {
						winston.warn('[init] Dependency checking skipped!');
						setImmediate(next);
					}
				},
				function (next) {
					require('./src/upgrade').check(next);
				}
			], function (err) {
				next(err);
			});
		},
		function (next) {
			var webserver = require('./src/webserver');
			require('./src/socket.io').init(webserver.server);

			if (nconf.get('isPrimary') === 'true' && !nconf.get('jobsDisabled')) {
				require('./src/notifications').init();
				require('./src/user').startJobs();
			}

			webserver.listen(next);
		}
	], function (err) {
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
				case 'dependencies-missing':
					winston.warn('One or more of NodeBB\'s dependent packages are missing. Please run the following command to update them:');
					winston.warn('    ./nodebb upgrade');
					break;
				default:
					winston.error(err);
					break;
			}

			// Either way, bad stuff happened. Abort start.
			process.exit();
		}

		if (process.send) {
			process.send({
				action: 'listening'
			});
		}
	});
}

function setup() {
	winston.info('NodeBB Setup Triggered via Command Line');

	var install = require('./src/install');
	var build = require('./build');

	process.stdout.write('\nWelcome to NodeBB!\n');
	process.stdout.write('\nThis looks like a new installation, so you\'ll have to answer a few questions about your environment before we can proceed.\n');
	process.stdout.write('Press enter to accept the default setting (shown in brackets).\n');

	async.series([
		async.apply(install.setup),
		async.apply(loadConfig),
		async.apply(build.buildAll)
	], function (err, data) {
		// Disregard build step data
		data = data[0];

		var separator = '     ';
		if (process.stdout.columns > 10) {
			for(var x = 0,cols = process.stdout.columns - 10; x < cols; x++) {
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
	var db = require('./src/database');
	var meta = require('./src/meta');
	var upgrade = require('./src/upgrade');
	var build = require('./build');

	async.series([
		async.apply(db.init),
		async.apply(meta.configs.init),
		async.apply(upgrade.upgrade),
		async.apply(build.buildAll)
	], function (err) {
		if (err) {
			winston.error(err.stack);
			process.exit(1);
		} else {
			process.exit(0);
		}
	});
}

function activate() {
	var db = require('./src/database');
	db.init(function (err) {
		if (err) {
			winston.error(err.stack);
			process.exit(1);
		}

		var plugin = nconf.get('activate');
		if (plugin.indexOf('nodebb-') !== 0) {
			// Allow omission of `nodebb-plugin-`
			plugin = 'nodebb-plugin-' + plugin;
		}

		winston.info('Activating plugin `%s`', plugin);
		db.sortedSetAdd('plugins:active', 0, plugin, function (err) {
			process.exit(err ? 1 : 0);
		});
	});
}

function listPlugins() {
	require('./src/database').init(function (err) {
		if (err) {
			winston.error(err.stack);
			process.exit(1);
		}

		var db = require('./src/database');

		db.getSortedSetRange('plugins:active', 0, -1, function (err, plugins) {
			if (err) {
				winston.error(err.stack);
				process.exit(1);
			}

			winston.info('Active plugins: \n\t - ' + plugins.join('\n\t - '));
			process.exit();
		});
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

function versionCheck() {
	var version = process.version.slice(1);
	var range = pkg.engines.node;
	var semver = require('semver');
	var compatible = semver.satisfies(version, range);

	if (!compatible) {
		winston.warn('Your version of Node.js is too outdated for NodeBB. Please update your version of Node.js.');
		winston.warn('Recommended ' + range.green + ', '.reset + version.yellow + ' provided\n'.reset);
	}
}