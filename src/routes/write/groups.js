'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	const middlewares = [middleware.ensureLoggedIn];

	setupApiRoute(router, 'post', '/', [...middlewares, middleware.checkRequired.bind(null, ['name'])], controllers.write.groups.create);
	setupApiRoute(router, 'head', '/:slug', [middleware.assert.group], controllers.write.groups.exists);
	setupApiRoute(router, 'put', '/:slug', [...middlewares, middleware.assert.group], controllers.write.groups.update);
	setupApiRoute(router, 'delete', '/:slug', [...middlewares, middleware.assert.group], controllers.write.groups.delete);
	setupApiRoute(router, 'put', '/:slug/membership/:uid', [...middlewares, middleware.assert.group], controllers.write.groups.join);
	setupApiRoute(router, 'delete', '/:slug/membership/:uid', [...middlewares, middleware.assert.group], controllers.write.groups.leave);
	setupApiRoute(router, 'put', '/:slug/ownership/:uid', [...middlewares, middleware.assert.group], controllers.write.groups.grant);
	setupApiRoute(router, 'delete', '/:slug/ownership/:uid', [...middlewares, middleware.assert.group], controllers.write.groups.rescind);

	return router;
};
