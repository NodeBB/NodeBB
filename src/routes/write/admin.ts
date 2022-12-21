'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	const middlewares = [middleware.ensureLoggedIn, middleware.admin.checkPrivileges];

	setupApiRoute(router, 'put', '/settings/:setting', [...middlewares, middleware.checkRequired.bind(null, ['value'])], controllers.write.admin.updateSetting);

	setupApiRoute(router, 'get', '/analytics', [...middlewares], controllers.write.admin.getAnalyticsKeys);
	setupApiRoute(router, 'get', '/analytics/:set', [...middlewares], controllers.write.admin.getAnalyticsData);

	return router;
};
