'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;

module.exports = function () {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, 'head', '/:slug', [middleware.assert.group], controllers.write.groups.exists);
	setupApiRoute(router, 'post', '/', [...middlewares, middleware.checkRequired.bind(null, ['name'])], controllers.write.groups.create);
	setupApiRoute(router, 'delete', '/:slug', [...middlewares, middleware.assert.group], controllers.write.groups.delete);
	setupApiRoute(router, 'put', '/:slug/membership/:uid', [...middlewares, middleware.assert.group], controllers.write.groups.join);
	setupApiRoute(router, 'delete', '/:slug/membership/:uid', [...middlewares, middleware.assert.group], controllers.write.groups.leave);

	return router;
};
