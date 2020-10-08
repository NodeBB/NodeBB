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

	setupApiRoute(router, '/', middleware, [...middlewares, middleware.checkRequired.bind(null, ['username']), middleware.isAdmin], 'post', controllers.write.users.create);
	setupApiRoute(router, '/', middleware, [...middlewares, middleware.checkRequired.bind(null, ['uids']), middleware.isAdmin, middleware.exposePrivileges], 'delete', controllers.write.users.deleteMany);

	setupApiRoute(router, '/:uid', middleware, [...middlewares, middleware.assert.user], 'put', controllers.write.users.update);
	setupApiRoute(router, '/:uid', middleware, [...middlewares, middleware.assert.user, middleware.exposePrivileges], 'delete', controllers.write.users.delete);

	setupApiRoute(router, '/:uid/password', middleware, [...middlewares, middleware.checkRequired.bind(null, ['newPassword']), middleware.assert.user], 'put', controllers.write.users.changePassword);

	setupApiRoute(router, '/:uid/follow', middleware, [...middlewares, middleware.assert.user], 'put', controllers.write.users.follow);
	setupApiRoute(router, '/:uid/follow', middleware, [...middlewares, middleware.assert.user], 'delete', controllers.write.users.unfollow);

	setupApiRoute(router, '/:uid/ban', middleware, [...middlewares, middleware.assert.user, middleware.exposePrivileges], 'put', controllers.write.users.ban);
	setupApiRoute(router, '/:uid/ban', middleware, [...middlewares, middleware.assert.user, middleware.exposePrivileges], 'delete', controllers.write.users.unban);

	setupApiRoute(router, '/:uid/tokens', middleware, [...middlewares, middleware.assert.user, middleware.exposePrivilegeSet], 'post', controllers.write.users.generateToken);
	setupApiRoute(router, '/:uid/tokens/:token', middleware, [...middlewares, middleware.assert.user, middleware.exposePrivilegeSet], 'delete', controllers.write.users.deleteToken);

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
