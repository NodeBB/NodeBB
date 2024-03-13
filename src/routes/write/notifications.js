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

	return router;
};
