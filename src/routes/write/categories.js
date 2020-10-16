'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;

module.exports = function () {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, 'post', '/', [...middlewares, middleware.checkRequired.bind(null, ['name']), middleware.isAdmin], controllers.write.categories.create);
	setupApiRoute(router, 'put', '/:cid', [...middlewares, middleware.isAdmin], controllers.write.categories.update);
	setupApiRoute(router, 'delete', '/:cid', [...middlewares, middleware.isAdmin], controllers.write.categories.delete);

	return router;
};
