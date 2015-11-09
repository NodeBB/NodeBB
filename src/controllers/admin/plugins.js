'use strict';

var async = require('async');
var plugins = require('../../plugins');

var pluginsController = {};

pluginsController.get = function(req, res, next) {
	async.parallel({
		compatible: function(next) {
			plugins.list(function(err, plugins) {
				if (err || !Array.isArray(plugins)) {
					plugins = [];
				}

				next(null, plugins);
			});
		},
		all: function(next) {
			plugins.list(false, function(err, plugins) {
				if (err || !Array.isArray(plugins)) {
					plugins = [];
				}

				next(null, plugins);
			});
		}
	}, function(err, payload) {
		if (err) {
			return next(err);
		}
		var compatiblePkgNames = payload.compatible.map(function(pkgData) {
				return pkgData.name;
			});

		res.render('admin/extend/plugins' , {
			installed: payload.compatible.filter(function(plugin) {
				return plugin.installed;
			}),
			download: payload.compatible.filter(function(plugin) {
				return !plugin.installed;
			}),
			incompatible: payload.all.filter(function(plugin) {
				return compatiblePkgNames.indexOf(plugin.name) === -1;
			})
		});
	});
};

module.exports = pluginsController;