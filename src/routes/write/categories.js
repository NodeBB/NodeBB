'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	const middlewares = [middleware.ensureLoggedIn];

	setupApiRoute(router, 'get', '/', controllers.write.categories.list);
	setupApiRoute(router, 'post', '/', [...middlewares, middleware.checkRequired.bind(null, ['name'])], controllers.write.categories.create);
	setupApiRoute(router, 'get', '/:cid', [], controllers.write.categories.get);
	setupApiRoute(router, 'put', '/:cid', [...middlewares], controllers.write.categories.update);
	setupApiRoute(router, 'delete', '/:cid', [...middlewares], controllers.write.categories.delete);

	setupApiRoute(router, 'get', '/:cid/count', [middleware.assert.category], controllers.write.categories.getTopicCount);
	setupApiRoute(router, 'get', '/:cid/posts', [middleware.assert.category], controllers.write.categories.getPosts);
	setupApiRoute(router, 'get', '/:cid/children', [middleware.assert.category], controllers.write.categories.getChildren);
	setupApiRoute(router, 'get', '/:cid/topics', [middleware.assert.category], controllers.write.categories.getTopics);

	setupApiRoute(router, 'put', '/:cid/watch', [...middlewares, middleware.assert.category], controllers.write.categories.setWatchState);
	setupApiRoute(router, 'delete', '/:cid/watch', [...middlewares, middleware.assert.category], controllers.write.categories.setWatchState);

	setupApiRoute(router, 'get', '/:cid/privileges', [...middlewares], controllers.write.categories.getPrivileges);
	setupApiRoute(router, 'put', '/:cid/privileges/:privilege', [...middlewares, middleware.checkRequired.bind(null, ['member'])], controllers.write.categories.setPrivilege);
	setupApiRoute(router, 'delete', '/:cid/privileges/:privilege', [...middlewares, middleware.checkRequired.bind(null, ['member'])], controllers.write.categories.setPrivilege);

	setupApiRoute(router, 'put', '/:cid/moderator/:uid', [...middlewares], controllers.write.categories.setModerator);
	setupApiRoute(router, 'delete', '/:cid/moderator/:uid', [...middlewares], controllers.write.categories.setModerator);

	return router;
};
