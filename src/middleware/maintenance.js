'use strict';

var nconf = require('nconf');
var meta = require('../meta');
var user = require('../user');

module.exports = function (middleware) {

	middleware.maintenanceMode = function (req, res, next) {
		if (parseInt(meta.config.maintenanceMode, 10) !== 1) {
			return next();
		}
		var url = req.url.replace(nconf.get('relative_path'), '');

		if (url.startsWith('/login') || url.startsWith('/api/login')) {
			return next();
		}

		user.isAdministrator(req.uid, function (err, isAdmin) {
			if (err || isAdmin) {
				return next(err);
			}

			res.status(503);
			var data = {
				site_title: meta.config.title || 'NodeBB',
				message: meta.config.maintenanceModeMessage,
			};

			if (res.locals.isAPI) {
				return res.json(data);
			}

			middleware.buildHeader(req, res, function () {
				res.render('503', data);
			});
		});
	};

};
