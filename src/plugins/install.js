'use strict';

var winston = require('winston');
var async = require('async');
var path = require('path');
var fs = require('fs');
var nconf = require('nconf');
var os = require('os');
var cproc = require('child_process');

var db = require('../database');
var meta = require('../meta');
var pubsub = require('../pubsub');
var events = require('../events');

var packageManager = nconf.get('package_manager') === 'yarn' ? 'yarn' : 'npm';
var packageManagerExecutable = packageManager;
var packageManagerCommands = {
	yarn: {
		install: 'add',
		uninstall: 'remove',
	},
	npm: {
		install: 'install',
		uninstall: 'uninstall',
	},
};

if (process.platform === 'win32') {
	packageManagerExecutable += '.cmd';
}

module.exports = function (Plugins) {
	if (nconf.get('isPrimary') === 'true') {
		pubsub.on('plugins:toggleInstall', function (data) {
			if (data.hostname !== os.hostname()) {
				toggleInstall(data.id, data.version);
			}
		});

		pubsub.on('plugins:upgrade', function (data) {
			if (data.hostname !== os.hostname()) {
				upgrade(data.id, data.version);
			}
		});
	}

	Plugins.toggleActive = function (id, callback) {
		callback = callback || function () {};
		var isActive;
		async.waterfall([
			function (next) {
				Plugins.isActive(id, next);
			},
			function (_isActive, next) {
				isActive = _isActive;
				if (isActive) {
					db.sortedSetRemove('plugins:active', id, next);
				} else {
					db.sortedSetCard('plugins:active', function (err, count) {
						if (err) {
							return next(err);
						}
						db.sortedSetAdd('plugins:active', count, id, next);
					});
				}
			},
			function (next) {
				meta.reloadRequired = true;
				Plugins.fireHook(isActive ? 'action:plugin.deactivate' : 'action:plugin.activate', { id: id });
				setImmediate(next);
			},
			function (next) {
				events.log({
					type: 'plugin-' + (isActive ? 'deactivate' : 'activate'),
					text: id,
				}, next);
			},
		], function (err) {
			if (err) {
				winston.warn('[plugins] Could not toggle active state on plugin \'' + id + '\'');
				return callback(err);
			}
			callback(null, { id: id, active: !isActive });
		});
	};

	Plugins.toggleInstall = function (id, version, callback) {
		pubsub.publish('plugins:toggleInstall', { hostname: os.hostname(), id: id, version: version });
		toggleInstall(id, version, callback);
	};

	function toggleInstall(id, version, callback) {
		var installed;
		var type;
		async.waterfall([
			function (next) {
				Plugins.isInstalled(id, next);
			},
			function (_installed, next) {
				installed = _installed;
				type = installed ? 'uninstall' : 'install';
				Plugins.isActive(id, next);
			},
			function (active, next) {
				if (active) {
					Plugins.toggleActive(id, function (err) {
						next(err);
					});
					return;
				}
				setImmediate(next);
			},
			function (next) {
				runPackageManagerCommand(type, id, version || 'latest', next);
			},
			function (next) {
				Plugins.get(id, next);
			},
			function (pluginData, next) {
				Plugins.fireHook('action:plugin.' + type, { id: id, version: version });
				setImmediate(next, null, pluginData);
			},
		], callback);
	}

	function runPackageManagerCommand(command, pkgName, version, callback) {
		cproc.execFile(packageManagerExecutable, [
			packageManagerCommands[packageManager][command],
			pkgName + (command === 'install' ? '@' + version : ''),
			'--save',
		], function (err, stdout) {
			if (err) {
				return callback(err);
			}

			winston.verbose('[plugins/' + command + '] ' + stdout);
			callback();
		});
	}

	Plugins.upgrade = function (id, version, callback) {
		pubsub.publish('plugins:upgrade', { hostname: os.hostname(), id: id, version: version });
		upgrade(id, version, callback);
	};

	function upgrade(id, version, callback) {
		async.waterfall([
			async.apply(runPackageManagerCommand, 'install', id, version || 'latest'),
			function (next) {
				Plugins.isActive(id, next);
			},
			function (isActive, next) {
				meta.reloadRequired = isActive;
				next(null, isActive);
			},
		], callback);
	}

	Plugins.isInstalled = function (id, callback) {
		var pluginDir = path.join(__dirname, '../../node_modules', id);

		fs.stat(pluginDir, function (err, stats) {
			callback(null, err ? false : stats.isDirectory());
		});
	};

	Plugins.isActive = function (id, callback) {
		db.isSortedSetMember('plugins:active', id, callback);
	};

	Plugins.getActive = function (callback) {
		db.getSortedSetRange('plugins:active', 0, -1, callback);
	};
};
