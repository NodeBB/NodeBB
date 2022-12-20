'use strict';

import { Router } from 'express';
import middleware from '../../middleware';
import controllers from '../../controllers';
import routeHelpers from '../helpers';

const { setupApiRoute } = routeHelpers;

const router = Router();

export default function () {
	const middlewares = [middleware.ensureLoggedIn, middleware.admin.checkPrivileges];

	setupApiRoute(router, 'put', '/settings/:setting', [...middlewares, middleware.checkRequired.bind(null, ['value'])], controllers.write.admin.updateSetting);

	setupApiRoute(router, 'get', '/analytics', [...middlewares], controllers.write.admin.getAnalyticsKeys);
	setupApiRoute(router, 'get', '/analytics/:set', [...middlewares], controllers.write.admin.getAnalyticsData);

	return router;
};
