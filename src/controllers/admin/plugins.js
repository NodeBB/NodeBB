'use strict';

var async = require('async');
var plugins = require('../../plugins');

var pluginsController = module.exports;

pluginsController.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			async.parallel({
				compatible: function (next) {
					plugins.list(function (err, plugins) {
						if (err || !Array.isArray(plugins)) {
							plugins = [];
						}

						next(null, plugins);
					});
				},
				all: function (next) {
					plugins.list(false, function (err, plugins) {
						if (err || !Array.isArray(plugins)) {
							plugins = [];
						}

						next(null, plugins);
					});
				},
			}, next);
		},
		function (payload) {
			var compatiblePkgNames = payload.compatible.map(function (pkgData) {
				return pkgData.name;
			});
			var installedPlugins = payload.compatible.filter(function (plugin) {
				return plugin && plugin.installed;
			});
			var activePlugins = payload.all.filter(function (plugin) {
				return plugin && plugin.installed && plugin.active;
			});

			res.render('admin/extend/plugins', {
				installed: installedPlugins,
				installedCount: installedPlugins.length,
				activeCount: activePlugins.length,
				inactiveCount: Math.max(0, installedPlugins.length - activePlugins.length),
				upgradeCount: payload.compatible.reduce(function (count, current) {
					if (current.installed && current.outdated) {
						count += 1;
					}
					return count;
				}, 0),
				download: payload.compatible.filter(function (plugin) {
					return !plugin.installed;
				}),
				incompatible: payload.all.filter(function (plugin) {
					return compatiblePkgNames.indexOf(plugin.name) === -1;
				}),
			});
		},
	], next);
};
