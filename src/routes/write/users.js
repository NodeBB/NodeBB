'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;

// eslint-disable-next-line no-unused-vars
function guestRoutes() {
	// like registration, login...
}

function authenticatedRoutes() {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, 'post', '/', [...middlewares, middleware.checkRequired.bind(null, ['username']), middleware.isAdmin], controllers.write.users.create);
	setupApiRoute(router, 'delete', '/', [...middlewares, middleware.checkRequired.bind(null, ['uids']), middleware.isAdmin, middleware.exposePrivileges], controllers.write.users.deleteMany);

	setupApiRoute(router, 'put', '/:uid', [...middlewares, middleware.assert.user], controllers.write.users.update);
	setupApiRoute(router, 'delete', '/:uid', [...middlewares, middleware.assert.user, middleware.exposePrivileges], controllers.write.users.delete);

	setupApiRoute(router, 'put', '/:uid/settings', [...middlewares, middleware.checkRequired.bind(null, ['settings'])], controllers.write.users.updateSettings);
	setupApiRoute(router, 'put', '/:uid/settings/:setting', [...middlewares, middleware.checkRequired.bind(null, ['value'])], controllers.write.users.updateSetting);

	setupApiRoute(router, 'put', '/:uid/password', [...middlewares, middleware.checkRequired.bind(null, ['newPassword']), middleware.assert.user], controllers.write.users.changePassword);

	setupApiRoute(router, 'put', '/:uid/follow', [...middlewares, middleware.assert.user], controllers.write.users.follow);
	setupApiRoute(router, 'delete', '/:uid/follow', [...middlewares, middleware.assert.user], controllers.write.users.unfollow);

	setupApiRoute(router, 'put', '/:uid/ban', [...middlewares, middleware.assert.user, middleware.exposePrivileges], controllers.write.users.ban);
	setupApiRoute(router, 'delete', '/:uid/ban', [...middlewares, middleware.assert.user, middleware.exposePrivileges], controllers.write.users.unban);

	setupApiRoute(router, 'post', '/:uid/tokens', [...middlewares, middleware.assert.user, middleware.exposePrivilegeSet], controllers.write.users.generateToken);
	setupApiRoute(router, 'delete', '/:uid/tokens/:token', [...middlewares, middleware.assert.user, middleware.exposePrivilegeSet], controllers.write.users.deleteToken);

	/**
	 * Implement this later...
	 */
	// 	app.route('/:uid/tokens')
	// 		.get(apiMiddleware.requireUser, function(req, res) {
	// 			if (parseInt(req.params.uid, 10) !== parseInt(req.user.uid, 10)) {
	// 				return errorHandler.respond(401, res);
	// 			}

	// 			auth.getTokens(req.params.uid, function(err, tokens) {
	// 				return errorHandler.handle(err, res, {
	// 					tokens: tokens
	// 				});
	// 			});
	// 		})
	// 		.post(apiMiddleware.requireUser, function(req, res) {
	// 			if (parseInt(req.params.uid, 10) !== parseInt(req.user.uid)) {
	// 				return errorHandler.respond(401, res);
	// 			}

	// 			auth.generateToken(req.params.uid, function(err, token) {
	// 				return errorHandler.handle(err, res, {
	// 					token: token
	// 				});
	// 			});
	// 		});

	// 	app.delete('/:uid/tokens/:token', apiMiddleware.requireUser, function(req, res) {
	// 		if (parseInt(req.params.uid, 10) !== req.user.uid) {
	// 			return errorHandler.respond(401, res);
	// 		}

	// 		auth.revokeToken(req.params.token, 'user', function(err) {
	// 			errorHandler.handle(err, res);
	// 		});
	// 	});
}

module.exports = function () {
	authenticatedRoutes();

	return router;
};
