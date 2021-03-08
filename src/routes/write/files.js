'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	const middlewares = [middleware.ensureLoggedIn];

	// setupApiRoute(router, 'put', '/', [
	// 	...middlewares,
	// 	middleware.checkRequired.bind(null, ['path']),
	// 	middleware.assert.folder
	// ], controllers.write.files.upload);
	setupApiRoute(router, 'delete', '/', [
		...middlewares,
		middleware.checkRequired.bind(null, ['path']),
		middleware.assert.path,
	], controllers.write.files.delete);

	return router;
};
