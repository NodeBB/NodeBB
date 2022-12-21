'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	const middlewares = [middleware.ensureLoggedIn, middleware.admin.checkPrivileges];

	// setupApiRoute(router, 'put', '/', [
	//  ...middlewares,
	//  middleware.checkRequired.bind(null, ['path']),
	//  middleware.assert.folder
	// ], controllers.write.files.upload);
	setupApiRoute(router, 'delete', '/', [
		...middlewares,
		middleware.checkRequired.bind(null, ['path']),
		middleware.assert.path,
	], controllers.write.files.delete);

	setupApiRoute(router, 'put', '/folder', [
		...middlewares,
		middleware.checkRequired.bind(null, ['path', 'folderName']),
		middleware.assert.path,
		// Should come after assert.path
		middleware.assert.folderName,
	], controllers.write.files.createFolder);

	return router;
};
