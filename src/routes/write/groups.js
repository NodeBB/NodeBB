'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;

module.exports = function () {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, '/', middleware, [...middlewares, middleware.checkRequired.bind(null, ['name']), middleware.exposePrivilegeSet], 'post', controllers.write.groups.create);
	setupApiRoute(router, '/:slug', middleware, [...middlewares, middleware.assert.group, middleware.exposePrivileges], 'delete', controllers.write.groups.delete);
	setupApiRoute(router, '/:slug/membership/:uid', middleware, [...middlewares, middleware.assert.group, middleware.exposePrivileges], 'put', controllers.write.groups.join);
	setupApiRoute(router, '/:slug/membership/:uid', middleware, [...middlewares, middleware.assert.group, middleware.exposePrivileges], 'delete', controllers.write.groups.leave);

	return router;
};
