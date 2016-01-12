'use strict';

var winston = require('winston'),
	async = require('async'),
	path = require('path'),
	fs = require('fs'),
	nconf = require('nconf'),
	os = require('os'),

	db = require('../database'),
	meta = require('../meta'),
	pubsub = require('../pubsub');


module.exports = function(Plugins) {

	if (nconf.get('isPrimary') === 'true') {
		pubsub.on('plugins:toggleInstall', function(data) {
			if (data.hostname !== os.hostname()) {
				toggleInstall(data.id, data.version);
			}
		});

		pubsub.on('plugins:upgrade', function(data) {
			if (data.hostname !== os.hostname()) {
				upgrade(data.id, data.version);
			}
		});
	}

	Plugins.toggleActive = function(id, callback) {
		callback = callback || function() {};
		var isActive;
		async.waterfall([
			function(next) {
				Plugins.isActive(id, next);
			},
			function(_isActive, next) {
				isActive = _isActive;
				if (isActive) {
					db.sortedSetRemove('plugins:active', id, next);
				} else {
					db.sortedSetCard('plugins:active', function(err, count) {
						if (err) {
							return next(err);
						}
						db.sortedSetAdd('plugins:active', count, id, next);
					});
				}
			},
			function(next) {
				meta.reloadRequired = true;
				Plugins.fireHook(isActive ? 'action:plugin.deactivate' : 'action:plugin.activate', id);
				next();
			}
		], function(err) {
			if (err) {
				winston.warn('[plugins] Could not toggle active state on plugin \'' + id + '\'');
				return callback(err);
			}
			callback(null, {id: id, active: !isActive});
		});
	};

	Plugins.toggleInstall = function(id, version, callback) {
		pubsub.publish('plugins:toggleInstall', {hostname: os.hostname(), id: id, version: version});
		toggleInstall(id, version, callback);
	};

	function toggleInstall(id, version, callback) {
		Plugins.isInstalled(id, function(err, installed) {
			if (err) {
				return callback(err);
			}
			var type = installed ? 'uninstall' : 'install';
			async.waterfall([
				function(next) {
					Plugins.isActive(id, next);
				},
				function(active, next) {
					if (active) {
						Plugins.toggleActive(id, function(err, status) {
							next(err);
						});
						return;
					}
					next();
				},
				function(next) {
					var command = installed ? ('npm uninstall ' + id) : ('npm install ' + id + '@' + (version || 'latest'));
					runNpmCommand(command, next);
				}
			], function(err) {
				if (err) {
					return callback(err);
				}

				Plugins.get(id, function(err, pluginData) {
					Plugins.fireHook('action:plugin.' + type, id);
					callback(null, pluginData);
				});
			});
		});
	}

	function runNpmCommand(command, callback) {
		require('child_process').exec(command, function (err, stdout) {
			if (err) {
				return callback(err);
			}
			winston.info('[plugins] ' + stdout);
			callback(err);
		 });
	}

	Plugins.upgrade = function(id, version, callback) {
		pubsub.publish('plugins:upgrade', {hostname: os.hostname(), id: id, version: version});
		upgrade(id, version, callback);
	};

	function upgrade(id, version, callback) {
		async.waterfall([
			function(next) {
				runNpmCommand('npm install ' + id + '@' + (version || 'latest'), next);
			},
			function(next) {
				Plugins.isActive(id, next);
			},
			function(isActive, next) {
				meta.reloadRequired = isActive;
				next(null, isActive);
			}
		], callback);
	}

	Plugins.isInstalled = function(id, callback) {
		var pluginDir = path.join(__dirname, '../../node_modules', id);

		fs.stat(pluginDir, function(err, stats) {
			callback(null, err ? false : stats.isDirectory());
		});
	};

	Plugins.isActive = function(id, callback) {
		db.isSortedSetMember('plugins:active', id, callback);
	};

	Plugins.getActive = function(callback) {
		db.getSortedSetRange('plugins:active', 0, -1, callback);
	};
};