'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	const middlewares = [middleware.ensureLoggedIn];

	setupApiRoute(router, 'post', '/', [...middlewares], controllers.write.flags.create);

	// Note: access control provided by middleware.assert.flag
	setupApiRoute(router, 'get', '/:flagId', [...middlewares, middleware.assert.flag], controllers.write.flags.get);
	setupApiRoute(router, 'put', '/:flagId', [...middlewares, middleware.assert.flag], controllers.write.flags.update);
	setupApiRoute(router, 'delete', '/:flagId', [...middlewares, middleware.assert.flag], controllers.write.flags.delete);

	setupApiRoute(router, 'delete', '/:flagId/report', middlewares, controllers.write.flags.rescind);

	setupApiRoute(router, 'post', '/:flagId/notes', [...middlewares, middleware.assert.flag], controllers.write.flags.appendNote);
	setupApiRoute(router, 'delete', '/:flagId/notes/:datetime', [...middlewares, middleware.assert.flag], controllers.write.flags.deleteNote);

	return router;
};
