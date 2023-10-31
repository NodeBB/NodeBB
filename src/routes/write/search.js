'use strict';

const router = require('express').Router();
// const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	// const middlewares = [];

	// maybe redirect to /search/posts?
	// setupApiRoute(router, 'post', '/', [...middlewares], controllers.write.search.TBD);

	setupApiRoute(router, 'get', '/categories', [], controllers.write.search.categories);

	return router;
};
