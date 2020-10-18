'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;

module.exports = function () {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, 'put', '/:pid', [...middlewares, middleware.checkRequired.bind(null, ['content'])], controllers.write.posts.edit);
	setupApiRoute(router, 'delete', '/:pid', [...middlewares, middleware.assert.post], controllers.write.posts.purge);

	setupApiRoute(router, 'put', '/:pid/state', [...middlewares, middleware.assert.post], controllers.write.posts.restore);
	setupApiRoute(router, 'delete', '/:pid/state', [...middlewares, middleware.assert.post], controllers.write.posts.delete);

	setupApiRoute(router, 'put', '/:pid/vote', [...middlewares, middleware.checkRequired.bind(null, ['delta']), middleware.assert.post], controllers.write.posts.vote);
	setupApiRoute(router, 'delete', '/:pid/vote', [...middlewares, middleware.assert.post], controllers.write.posts.unvote);

	setupApiRoute(router, 'put', '/:pid/bookmark', [...middlewares, middleware.assert.post], controllers.write.posts.bookmark);
	setupApiRoute(router, 'delete', '/:pid/bookmark', [...middlewares, middleware.assert.post], controllers.write.posts.unbookmark);

	return router;
};
