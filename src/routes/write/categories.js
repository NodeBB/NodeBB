'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;

module.exports = function () {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, 'post', '/', [...middlewares, middleware.checkRequired.bind(null, ['name'])], controllers.write.categories.create);
	setupApiRoute(router, 'get', '/:cid', [middleware.authenticateOrGuest], controllers.write.categories.get);
	setupApiRoute(router, 'put', '/:cid', [...middlewares], controllers.write.categories.update);
	setupApiRoute(router, 'delete', '/:cid', [...middlewares], controllers.write.categories.delete);

	return router;
};
