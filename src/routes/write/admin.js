'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;

module.exports = function () {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, '/settings/:setting', middleware, [...middlewares, middleware.checkRequired.bind(null, ['value']), middleware.exposePrivilegeSet], 'put', controllers.write.admin.updateSetting);

	return router;
};
