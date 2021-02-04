'use strict';

const util = require('util');
const nconf = require('nconf');
const meta = require('../meta');
const user = require('../user');
const helpers = require('./helpers');

module.exports = function (middleware) {
	middleware.maintenanceMode = helpers.try(async (req, res, next) => {
		if (!meta.config.maintenanceMode) {
			return next();
		}

		const hooksAsync = util.promisify(middleware.pluginHooks);
		await hooksAsync(req, res);

		const url = req.url.replace(nconf.get('relative_path'), '');
		if (url.startsWith('/login') || url.startsWith('/api/login')) {
			return next();
		}

		const isAdmin = await user.isAdministrator(req.uid);
		if (isAdmin) {
			return next();
		}

		res.status(meta.config.maintenanceModeStatus);

		const data = {
			site_title: meta.config.title || 'NodeBB',
			message: meta.config.maintenanceModeMessage,
		};

		if (res.locals.isAPI) {
			return res.json(data);
		}
		await middleware.buildHeaderAsync(req, res);
		res.render('503', data);
	});
};
