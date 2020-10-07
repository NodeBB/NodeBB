'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;

module.exports = function () {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, '/', middleware, [...middlewares, middleware.checkRequired.bind(null, ['name']), middleware.isAdmin], 'post', controllers.write.categories.create);
	setupApiRoute(router, '/:cid', middleware, [...middlewares, middleware.isAdmin], 'put', controllers.write.categories.update);
	setupApiRoute(router, '/:cid', middleware, [...middlewares, middleware.isAdmin], 'delete', controllers.write.categories.delete);

	return router;
};
