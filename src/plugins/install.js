'use strict';

var winston = require('winston'),
	async = require('async'),
	npm = require('npm'),
	path = require('path'),
	fs = require('fs'),

	db = require('../database'),
	meta = require('../meta'),
	pubsub = require('../pubsub');


module.exports = function(Plugins) {

	Plugins.toggleActive = function(id, callback) {
		Plugins.isActive(id, function(err, active) {
			if (err) {
				winston.warn('[plugins] Could not toggle active state on plugin \'' + id + '\'');
				return callback(err);
			}

			db[(active ? 'setRemove' : 'setAdd')]('plugins:active', id, function(err, success) {
				if (err) {
					winston.warn('[plugins] Could not toggle active state on plugin \'' + id + '\'');
					return callback(err);
				}

				meta.reloadRequired = true;

				if (active) {
					Plugins.fireHook('action:plugin.deactivate', id);
				}

				if (typeof callback === 'function') {
					callback(null, {
						id: id,
						active: !active
					});
				}
			});
		});
	};

	Plugins.toggleInstall = function(id, version, callback) {
		Plugins.isInstalled(id, function(err, installed) {
			if (err) {
				return callback(err);
			}

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
					npm.commands[installed ? 'uninstall' : 'install'](installed ? id : [id + '@' + (version || 'latest')], next);
				}
			], function(err) {
				callback(err, {
					id: id,
					installed: !installed
				});
			});
		});
	};

	Plugins.upgrade = function(id, version, callback) {
		async.waterfall([
			function(next) {
				npm.load({}, next);
			},
			function(res, next) {
				npm.commands.install([id + '@' + (version || 'latest')], next);
			}
		], callback);
	};

	Plugins.isInstalled = function(id, callback) {
		var pluginDir = path.join(__dirname, '../node_modules', id);

		fs.stat(pluginDir, function(err, stats) {
			callback(null, err ? false : stats.isDirectory());
		});
	};

	Plugins.isActive = function(id, callback) {
		db.isSetMember('plugins:active', id, callback);
	};
};