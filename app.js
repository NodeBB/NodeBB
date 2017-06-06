/*
	NodeBB - A better forum platform for the modern web
	https://github.com/NodeBB/NodeBB/
	Copyright (C) 2013-2017  NodeBB Inc.

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

'use strict';

if (require.main !== module) {
	require.main.require = function (path) {
		return require(path);
	};
}

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
		return nconf.get('json-logging') ? date.toJSON() :	date.getDate() + '/' + (date.getMonth() + 1) + ' ' + date.toTimeString().substr(0, 8) + ' [' + global.process.pid + ']';
	},
	level: nconf.get('log-level') || (global.env === 'production' ? 'info' : 'verbose'),
	json: (!!nconf.get('json-logging')),
	stringify: (!!nconf.get('json-logging')),
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
		async.apply(require('./src/meta/build').buildAll),
	], function (err) {
		process.exit(err ? 1 : 0);
	});
} else if (nconf.get('activate')) {
	activate();
} else if (nconf.get('plugins')) {
	listPlugins();
} else if (nconf.get('build')) {
	require('./src/meta/build').build(nconf.get('build'));
} else if (nconf.get('events')) {
	async.series([
		async.apply(require('./src/database').init),
		async.apply(require('./src/events').output),
	]);
} else {
	require('./src/start').start();
}

function loadConfig(callback) {
	winston.verbose('* using configuration stored in: %s', configFile);

	nconf.file({
		file: configFile,
	});

	nconf.defaults({
		base_dir: __dirname,
		themes_path: path.join(__dirname, 'node_modules'),
		upload_path: 'public/uploads',
		views_dir: path.join(__dirname, 'build/public/templates'),
		version: pkg.version,
	});

	if (!nconf.get('isCluster')) {
		nconf.set('isPrimary', 'true');
		nconf.set('isCluster', 'false');
	}

	// Ensure themes_path is a full filepath
	nconf.set('themes_path', path.resolve(__dirname, nconf.get('themes_path')));
	nconf.set('core_templates_path', path.join(__dirname, 'src/views'));
	nconf.set('base_templates_path', path.join(nconf.get('themes_path'), 'nodebb-theme-persona/templates'));

	nconf.set('upload_path', path.resolve(nconf.get('base_dir'), nconf.get('upload_path')));

	if (nconf.get('url')) {
		nconf.set('url_parsed', url.parse(nconf.get('url')));
	}

	// Explicitly cast 'jobsDisabled' as Bool
	var castAsBool = ['jobsDisabled'];
	nconf.stores.env.readOnly = false;
	castAsBool.forEach(function (prop) {
		var value = nconf.get(prop);
		if (value) {
			nconf.set(prop, typeof value === 'boolean' ? value : String(value).toLowerCase() === 'true');
		}
	});
	nconf.stores.env.readOnly = true;

	if (typeof callback === 'function') {
		callback();
	}
}

function setup() {
	winston.info('NodeBB Setup Triggered via Command Line');

	var install = require('./src/install');
	var build = require('./src/meta/build');

	process.stdout.write('\nWelcome to NodeBB!\n');
	process.stdout.write('\nThis looks like a new installation, so you\'ll have to answer a few questions about your environment before we can proceed.\n');
	process.stdout.write('Press enter to accept the default setting (shown in brackets).\n');

	async.series([
		async.apply(install.setup),
		async.apply(loadConfig),
		async.apply(build.buildAll),
	], function (err, data) {
		// Disregard build step data
		data = data[0];

		var separator = '     ';
		if (process.stdout.columns > 10) {
			for (var x = 0, cols = process.stdout.columns - 10; x < cols; x += 1) {
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
	var build = require('./src/meta/build');
	var tasks = [db.init, meta.configs.init, upgrade.run, build.buildAll];

	if (nconf.get('upgrade') !== true) {
		// Likely an upgrade script name passed in
		tasks[2] = async.apply(upgrade.runSingle, nconf.get('upgrade'));

		// Skip build
		tasks.pop();
	}
	// disable mongo timeouts during upgrade
	nconf.set('mongo:options:socketTimeoutMS', 0);
	async.series(tasks, function (err) {
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
	var plugins = require('./src/plugins');
	var events = require('./src/events');
	var plugin = nconf.get('activate');
	async.waterfall([
		function (next) {
			db.init(next);
		},
		function (next) {
			if (plugin.indexOf('nodebb-') !== 0) {
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
			winston.error(err.message);
		}
		process.exit(err ? 1 : 0);
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
