'use strict';

var winston = require('winston'),
	async = require('async'),
	npm = require('npm'),
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
				db[isActive ? 'setRemove' : 'setAdd']('plugins:active', id, next);
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
					npm.load({}, next);
				},
				function(res, next) {
					npm.commands[type](installed ? id : [id + '@' + (version || 'latest')], next);
				}
			], function(err) {
				if (err) {
					return callback(err);
				}
				plugins.fireHook('action:plugin.' + type, id);
				callback(null, {id: id, installed: !installed});
			});
		});
	}

	Plugins.upgrade = function(id, version, callback) {
		pubsub.publish('plugins:upgrade', {hostname: os.hostname(), id: id, version: version});
		upgrade(id, version, callback);
	};

	function upgrade(id, version, callback) {
		async.waterfall([
			function(next) {
				npm.load({}, next);
			},
			function(res, next) {
				npm.commands.install([id + '@' + (version || 'latest')], next);
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
		db.isSetMember('plugins:active', id, callback);
	};
};