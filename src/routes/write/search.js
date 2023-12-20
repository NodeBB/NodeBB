'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	const middlewares = [middleware.ensureLoggedIn];

	// maybe redirect to /search/posts?
	// setupApiRoute(router, 'post', '/', [...middlewares], controllers.write.search.TBD);

	setupApiRoute(router, 'get', '/categories', [], controllers.write.search.categories);

	setupApiRoute(router, 'get', '/chats/:roomId/users', [...middlewares, middleware.checkRequired.bind(null, ['query']), middleware.canChat, middleware.assert.room], controllers.write.search.roomUsers);
	setupApiRoute(router, 'get', '/chats/:roomId/messages', [...middlewares, middleware.checkRequired.bind(null, ['query']), middleware.canChat, middleware.assert.room], controllers.write.search.roomMessages);

	return router;
};
