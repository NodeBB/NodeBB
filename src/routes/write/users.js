'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;
// 	Messaging = require.main.require('./src/messaging'),
// 	apiMiddleware = require('./middleware'),
// 	errorHandler = require('../../lib/errorHandler'),
// 	auth = require('../../lib/auth'),
// 	utils = require('./utils'),
// 	async = require.main.require('async');

// eslint-disable-next-line no-unused-vars
function guestRoutes() {
	// like registration, login...
}

function authenticatedRoutes() {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, '/', middleware, [...middlewares, middleware.checkRequired.bind(null, ['username']), middleware.isAdmin], 'post', controllers.write.users.create);
	setupApiRoute(router, '/', middleware, [...middlewares, middleware.checkRequired.bind(null, ['uids']), middleware.isAdmin, middleware.exposePrivileges], 'delete', controllers.write.users.deleteMany);

	setupApiRoute(router, '/:uid', middleware, [...middlewares], 'put', controllers.write.users.update);
	setupApiRoute(router, '/:uid', middleware, [...middlewares, middleware.exposePrivileges], 'delete', controllers.write.users.delete);

	setupApiRoute(router, '/:uid/password', middleware, [...middlewares, middleware.checkRequired.bind(null, ['newPassword'])], 'put', controllers.write.users.changePassword);

	setupApiRoute(router, '/:uid/follow', middleware, [...middlewares], 'post', controllers.write.users.follow);
	setupApiRoute(router, '/:uid/unfollow', middleware, [...middlewares], 'delete', controllers.write.users.unfollow);

	// 	app.put('/:uid/follow', apiMiddleware.requireUser, function(req, res) {
	// 		Users.follow(req.user.uid, req.params.uid, function(err) {
	// 			return errorHandler.handle(err, res);
	// 		});
	// 	});

	// 	app.delete('/:uid/follow', apiMiddleware.requireUser, function(req, res) {
	// 		Users.unfollow(req.user.uid, req.params.uid, function(err) {
	// 			return errorHandler.handle(err, res);
	// 		});
	// 	});

	// 	app.route('/:uid/chats')
	// 		.post(apiMiddleware.requireUser, function(req, res) {
	// 			if (!utils.checkRequired(['message'], req, res)) {
	// 				return false;
	// 			}

	// 			var timestamp = parseInt(req.body.timestamp, 10) || Date.now();

	// 			function addMessage(roomId) {
	// 				Messaging.addMessage({
	// 					uid: req.user.uid,
	// 					roomId: roomId,
	// 					content: req.body.message,
	// 					timestamp: timestamp,
	// 				}, function(err, message) {
	// 					if (parseInt(req.body.quiet, 10) !== 1) {
	// 						Messaging.notifyUsersInRoom(req.user.uid, roomId, message);
	// 					}

	// 					return errorHandler.handle(err, res, message);
	// 				});
	// 			}

	// 			Messaging.canMessageUser(req.user.uid, req.params.uid, function(err) {
	// 				if (err) {
	// 					return errorHandler.handle(err, res);
	// 				}

	// 				if (req.body.roomId) {
	// 					addMessage(req.body.roomId);
	// 				} else {
	// 					Messaging.newRoom(req.user.uid, [req.params.uid], function(err, roomId) {
	// 						if (err) {
	// 							return errorHandler.handle(err, res);
	// 						}

	// 						addMessage(roomId);
	// 					});
	// 				}
	// 			});
	// 		});

	// 	app.route('/:uid/ban')
	// 		.put(apiMiddleware.requireUser, apiMiddleware.requireAdmin, function(req, res) {
	// 			Users.bans.ban(req.params.uid, req.body.until || 0, req.body.reason || '', function(err) {
	// 				errorHandler.handle(err, res);
	// 			});
	// 		})
	// 		.delete(apiMiddleware.requireUser, apiMiddleware.requireAdmin, function(req, res) {
	// 			Users.bans.unban(req.params.uid, function(err) {
	// 				errorHandler.handle(err, res);
	// 			});
	// 		});

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
