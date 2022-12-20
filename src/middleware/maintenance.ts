'use strict';

import util from 'util';
import nconf from 'nconf';
import meta from '../meta';
import user from '../user';
import groups from '../groups';
import helpers from './helpers';

export default function (middleware) {
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

		const [isAdmin, isMemberOfExempt] = await Promise.all([
			user.isAdministrator(req.uid),
			groups.isMemberOfAny(req.uid, meta.config.groupsExemptFromMaintenanceMode),
		]);

		if (isAdmin || isMemberOfExempt) {
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
