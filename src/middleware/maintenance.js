'use strict';

const util = require('util');
const nconf = require('nconf');
const meta = require('../meta');
const user = require('../user');

module.exports = function (middleware) {
	middleware.maintenanceMode = async function maintenanceMode(req, res, next) {
		if (!meta.config.maintenanceMode) {
			return setImmediate(next);
		}

		const hooksAsync = util.promisify(middleware.pluginHooks);
		await hooksAsync(req, res);

		const url = req.url.replace(nconf.get('relative_path'), '');
		if (url.startsWith('/login') || url.startsWith('/api/login')) {
			return setImmediate(next);
		}

		const isAdmin = await user.isAdministrator(req.uid);
		if (isAdmin) {
			return setImmediate(next);
		}

		res.status(meta.config.maintenanceModeStatus);

		const data = {
			site_title: meta.config.title || 'NodeBB',
			message: meta.config.maintenanceModeMessage,
		};

		if (res.locals.isAPI) {
			return res.json(data);
		}
		const buildHeaderAsync = util.promisify(middleware.buildHeader);
		await buildHeaderAsync(req, res);
		res.render('503', data);
	};
};
