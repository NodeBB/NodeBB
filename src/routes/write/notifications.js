'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	const middlewares = [middleware.ensureLoggedIn];

	setupApiRoute(router, 'get', '/count', [...middlewares], controllers.write.notifications.getCount);

	setupApiRoute(router, 'get', '/:nid?', [...middlewares], controllers.write.notifications.get);

	setupApiRoute(router, 'put', '/:nid/read', [...middlewares], controllers.write.notifications.markRead);

	setupApiRoute(router, 'delete', '/:nid/read', [...middlewares], controllers.write.notifications.markUnread);

	return router;
};
