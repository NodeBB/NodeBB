'use strict';

const util = require('util');
import nconf from 'nconf';
import meta from '../meta';
import user from '../user';
const groups = require('../groups');
import helpers from './helpers';

export default  function (middleware) {
	middleware.maintenanceMode = helpers.try(async (req, res, next) => {
		if (!meta.configs.maintenanceMode) {
			return next();
		}

		const hooksAsync = util.promisify(middleware.pluginHooks);
		await hooksAsync(req, res);

		const url = req.url.replace(nconf.get('relative_path'), '');
		if (url.startsWith('/login') || url.startsWith('/api/login')) {
			return next();
		}

		const [isAdmin, isMemberOfExempt] = await Promise.all([
			user.isAdministrator(req.uid),
			groups.isMemberOfAny(req.uid, meta.configs.groupsExemptFromMaintenanceMode),
		]);

		if (isAdmin || isMemberOfExempt) {
			return next();
		}

		res.status(meta.configs.maintenanceModeStatus);

		const data = {
			site_title: meta.configs.title || 'NodeBB',
			message: meta.configs.maintenanceModeMessage,
		} as any;

		if (res.locals.isAPI) {
			return res.json(data);
		}
		await middleware.buildHeaderAsync(req, res);
		res.render('503', data);
	});
};
