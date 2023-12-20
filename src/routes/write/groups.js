'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	const middlewares = [middleware.ensureLoggedIn];

	setupApiRoute(router, 'get', '/', [], controllers.write.groups.list);
	setupApiRoute(router, 'post', '/', [...middlewares, middleware.checkRequired.bind(null, ['name'])], controllers.write.groups.create);
	setupApiRoute(router, 'head', '/:slug', [middleware.assert.group], controllers.write.groups.exists);
	setupApiRoute(router, 'put', '/:slug', [...middlewares, middleware.assert.group], controllers.write.groups.update);
	setupApiRoute(router, 'delete', '/:slug', [...middlewares, middleware.assert.group], controllers.write.groups.delete);

	setupApiRoute(router, 'get', '/:slug/members', [...middlewares, middleware.assert.group], controllers.write.groups.listMembers);

	setupApiRoute(router, 'put', '/:slug/membership/:uid', [...middlewares, middleware.assert.group], controllers.write.groups.join);
	setupApiRoute(router, 'delete', '/:slug/membership/:uid', [...middlewares, middleware.assert.group], controllers.write.groups.leave);

	setupApiRoute(router, 'put', '/:slug/ownership/:uid', [...middlewares, middleware.assert.group], controllers.write.groups.grant);
	setupApiRoute(router, 'delete', '/:slug/ownership/:uid', [...middlewares, middleware.assert.group], controllers.write.groups.rescind);

	setupApiRoute(router, 'get', '/:slug/pending', [...middlewares, middleware.assert.group], controllers.write.groups.getPending);
	setupApiRoute(router, 'put', '/:slug/pending/:uid', [...middlewares, middleware.assert.group], controllers.write.groups.accept);
	setupApiRoute(router, 'delete', '/:slug/pending/:uid', [...middlewares, middleware.assert.group], controllers.write.groups.reject);

	setupApiRoute(router, 'get', '/:slug/invites', [...middlewares, middleware.assert.group], controllers.write.groups.getInvites);
	setupApiRoute(router, 'post', '/:slug/invites/:uid', [...middlewares, middleware.assert.group], controllers.write.groups.issueInvite);
	setupApiRoute(router, 'put', '/:slug/invites/:uid', [...middlewares, middleware.assert.group], controllers.write.groups.acceptInvite);
	setupApiRoute(router, 'delete', '/:slug/invites/:uid', [...middlewares, middleware.assert.group], controllers.write.groups.rejectInvite);

	return router;
};
