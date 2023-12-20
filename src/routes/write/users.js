'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

// eslint-disable-next-line no-unused-vars
function guestRoutes() {
	// like registration, login...
}

function authenticatedRoutes() {
	const middlewares = [middleware.ensureLoggedIn];

	setupApiRoute(router, 'post', '/', [...middlewares, middleware.checkRequired.bind(null, ['username'])], controllers.write.users.create);
	setupApiRoute(router, 'delete', '/', [...middlewares, middleware.checkRequired.bind(null, ['uids'])], controllers.write.users.deleteMany);

	setupApiRoute(router, 'head', '/:uid', [middleware.assert.user], controllers.write.users.exists);
	setupApiRoute(router, 'get', '/:uid', [...middlewares, middleware.assert.user], controllers.write.users.get);
	setupApiRoute(router, 'put', '/:uid', [...middlewares, middleware.assert.user], controllers.write.users.update);
	setupApiRoute(router, 'delete', '/:uid', [...middlewares, middleware.assert.user], controllers.write.users.delete);
	setupApiRoute(router, 'put', '/:uid/picture', [...middlewares, middleware.assert.user], controllers.write.users.changePicture);
	setupApiRoute(router, 'delete', '/:uid/content', [...middlewares, middleware.assert.user], controllers.write.users.deleteContent);
	setupApiRoute(router, 'delete', '/:uid/account', [...middlewares, middleware.assert.user], controllers.write.users.deleteAccount);

	setupApiRoute(router, 'get', '/:uid/status', [], controllers.write.users.getStatus);
	setupApiRoute(router, 'head', '/:uid/status/:status', [], controllers.write.users.checkStatus);

	setupApiRoute(router, 'get', '/:uid/chat', [...middlewares], controllers.write.users.getPrivateRoomId);

	setupApiRoute(router, 'put', '/:uid/settings', [...middlewares, middleware.checkRequired.bind(null, ['settings'])], controllers.write.users.updateSettings);

	setupApiRoute(router, 'put', '/:uid/password', [...middlewares, middleware.checkRequired.bind(null, ['newPassword']), middleware.assert.user], controllers.write.users.changePassword);

	setupApiRoute(router, 'put', '/:uid/follow', [...middlewares, middleware.assert.user], controllers.write.users.follow);
	setupApiRoute(router, 'delete', '/:uid/follow', [...middlewares, middleware.assert.user], controllers.write.users.unfollow);

	setupApiRoute(router, 'put', '/:uid/ban', [...middlewares, middleware.assert.user], controllers.write.users.ban);
	setupApiRoute(router, 'delete', '/:uid/ban', [...middlewares, middleware.assert.user], controllers.write.users.unban);

	setupApiRoute(router, 'put', '/:uid/mute', [...middlewares, middleware.assert.user], controllers.write.users.mute);
	setupApiRoute(router, 'delete', '/:uid/mute', [...middlewares, middleware.assert.user], controllers.write.users.unmute);

	setupApiRoute(router, 'post', '/:uid/tokens', [...middlewares, middleware.assert.user], controllers.write.users.generateToken);
	setupApiRoute(router, 'delete', '/:uid/tokens/:token', [...middlewares, middleware.assert.user], controllers.write.users.deleteToken);

	setupApiRoute(router, 'delete', '/:uid/sessions/:uuid', [...middlewares, middleware.assert.user], controllers.write.users.revokeSession);

	setupApiRoute(router, 'post', '/:uid/invites', middlewares, controllers.write.users.invite);
	setupApiRoute(router, 'get', '/:uid/invites/groups', [...middlewares, middleware.assert.user], controllers.write.users.getInviteGroups);

	setupApiRoute(router, 'get', '/:uid/emails', [...middlewares, middleware.assert.user], controllers.write.users.listEmails);
	setupApiRoute(router, 'post', '/:uid/emails', [...middlewares, middleware.assert.user], controllers.write.users.addEmail);
	setupApiRoute(router, 'get', '/:uid/emails/:email', [...middlewares, middleware.assert.user], controllers.write.users.getEmail);
	setupApiRoute(router, 'post', '/:uid/emails/:email/confirm', [...middlewares, middleware.assert.user], controllers.write.users.confirmEmail);

	setupApiRoute(router, 'head', '/:uid/exports/:type', [...middlewares, middleware.assert.user, middleware.checkAccountPermissions], controllers.write.users.checkExportByType);
	setupApiRoute(router, 'get', '/:uid/exports/:type', [...middlewares, middleware.assert.user, middleware.checkAccountPermissions], controllers.write.users.getExportByType);
	setupApiRoute(router, 'post', '/:uid/exports/:type', [...middlewares, middleware.assert.user, middleware.checkAccountPermissions], controllers.write.users.generateExportsByType);

	// Shorthand route to access user routes by userslug
	router.all('/+bySlug/:userslug*?', [], controllers.write.users.redirectBySlug);
}

module.exports = function () {
	authenticatedRoutes();

	return router;
};
