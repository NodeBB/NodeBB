'use strict';

var async = require('async');
var nconf = require('nconf');
var meta = require('../meta');
var user = require('../user');

module.exports = function (middleware) {
	middleware.maintenanceMode = function (req, res, callback) {
		if (parseInt(meta.config.maintenanceMode, 10) !== 1) {
			return callback();
		}
		var url = req.url.replace(nconf.get('relative_path'), '');

		if (url.startsWith('/login') || url.startsWith('/api/login')) {
			return callback();
		}
		var data;
		async.waterfall([
			function (next) {
				user.isAdministrator(req.uid, next);
			},
			function (isAdmin, next) {
				if (isAdmin) {
					return callback();
				}
				res.status(503);
				data = {
					site_title: meta.config.title || 'NodeBB',
					message: meta.config.maintenanceModeMessage,
				};

				if (res.locals.isAPI) {
					return res.json(data);
				}

				middleware.buildHeader(req, res, next);
			},
			function () {
				res.render('503', data);
			},
		], callback);
	};
};
