'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	const middlewares = [middleware.ensureLoggedIn, middleware.assert.post];

	setupApiRoute(router, 'get', '/:pid', [middleware.assert.post], controllers.write.posts.get);
	// There is no POST route because you POST to a topic to create a new post. Intuitive, no?
	setupApiRoute(router, 'put', '/:pid', [middleware.ensureLoggedIn, middleware.checkRequired.bind(null, ['content'])], controllers.write.posts.edit);
	setupApiRoute(router, 'delete', '/:pid', middlewares, controllers.write.posts.purge);

	setupApiRoute(router, 'get', '/:pid/index', [middleware.assert.post], controllers.write.posts.getIndex);
	setupApiRoute(router, 'get', '/:pid/raw', [middleware.assert.post], controllers.write.posts.getRaw);
	setupApiRoute(router, 'get', '/:pid/summary', [middleware.assert.post], controllers.write.posts.getSummary);

	setupApiRoute(router, 'put', '/:pid/state', middlewares, controllers.write.posts.restore);
	setupApiRoute(router, 'delete', '/:pid/state', middlewares, controllers.write.posts.delete);

	setupApiRoute(router, 'put', '/:pid/move', [...middlewares, middleware.checkRequired.bind(null, ['tid'])], controllers.write.posts.move);

	setupApiRoute(router, 'put', '/:pid/vote', [...middlewares, middleware.checkRequired.bind(null, ['delta'])], controllers.write.posts.vote);
	setupApiRoute(router, 'delete', '/:pid/vote', middlewares, controllers.write.posts.unvote);
	setupApiRoute(router, 'get', '/:pid/voters', [middleware.assert.post], controllers.write.posts.getVoters);
	setupApiRoute(router, 'get', '/:pid/upvoters', [middleware.assert.post], controllers.write.posts.getUpvoters);

	setupApiRoute(router, 'put', '/:pid/bookmark', middlewares, controllers.write.posts.bookmark);
	setupApiRoute(router, 'delete', '/:pid/bookmark', middlewares, controllers.write.posts.unbookmark);

	setupApiRoute(router, 'get', '/:pid/diffs', [middleware.assert.post], controllers.write.posts.getDiffs);
	setupApiRoute(router, 'get', '/:pid/diffs/:since', [middleware.assert.post], controllers.write.posts.loadDiff);
	setupApiRoute(router, 'put', '/:pid/diffs/:since', middlewares, controllers.write.posts.restoreDiff);
	setupApiRoute(router, 'delete', '/:pid/diffs/:timestamp', middlewares, controllers.write.posts.deleteDiff);

	setupApiRoute(router, 'get', '/:pid/replies', [middleware.assert.post], controllers.write.posts.getReplies);

	// Shorthand route to access post routes by topic index
	router.all('/+byIndex/:index*?', [middleware.checkRequired.bind(null, ['tid'])], controllers.write.posts.redirectByIndex);

	return router;
};
