'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	const middlewares = [middleware.ensureLoggedIn];

	setupApiRoute(router, 'put', '/:tag/follow', [...middlewares], controllers.write.tags.follow);
	setupApiRoute(router, 'delete', '/:tag/follow', [...middlewares], controllers.write.tags.unfollow);

	return router;
};
