'use strict';

const router = require('express').Router();
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	setupApiRoute(router, 'get', '/query/:handle', [], controllers.write.intents.query);

	return router;
};
