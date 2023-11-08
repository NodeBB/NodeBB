'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	const middlewares = [middleware.ensureLoggedIn, middleware.admin.checkPrivileges];

	setupApiRoute(router, 'put', '/settings/:setting', [...middlewares, middleware.checkRequired.bind(null, ['value'])], controllers.write.admin.updateSetting);

	setupApiRoute(router, 'get', '/analytics', [...middlewares], controllers.write.admin.getAnalyticsKeys);
	setupApiRoute(router, 'get', '/analytics/:set', [...middlewares], controllers.write.admin.getAnalyticsData);

	setupApiRoute(router, 'post', '/tokens', [...middlewares], controllers.write.admin.generateToken);
	setupApiRoute(router, 'get', '/tokens/:token', [...middlewares], controllers.write.admin.getToken);
	setupApiRoute(router, 'put', '/tokens/:token', [...middlewares], controllers.write.admin.updateToken);
	setupApiRoute(router, 'delete', '/tokens/:token', [...middlewares], controllers.write.admin.deleteToken);
	setupApiRoute(router, 'post', '/tokens/:token/roll', [...middlewares], controllers.write.admin.rollToken);

	setupApiRoute(router, 'delete', '/chats/:roomId', [...middlewares, middleware.assert.room], controllers.write.admin.chats.deleteRoom);

	setupApiRoute(router, 'get', '/groups', [...middlewares], controllers.write.admin.listGroups);

	return router;
};
