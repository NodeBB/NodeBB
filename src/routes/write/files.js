'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;

module.exports = function () {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, '/', middleware, [...middlewares, middleware.checkRequired.bind(null, ['path']), middleware.assertPath], 'delete', controllers.write.files.delete);

	return router;
};
