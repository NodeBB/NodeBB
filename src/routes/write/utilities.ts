'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	// The "ping" routes are mounted at root level, but for organizational purposes, the controllers are in `utilities.js`

	setupApiRoute(router, 'post', '/login', [middleware.checkRequired.bind(null, ['username', 'password'])], controllers.write.utilities.login);

	return router;
};
