'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;

module.exports = function () {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, '/:pid', middleware, [...middlewares, middleware.checkRequired.bind(null, ['content'])], 'put', controllers.write.posts.edit);
	setupApiRoute(router, '/:pid', middleware, [...middlewares, middleware.assertPost], 'delete', controllers.write.posts.purge);

	setupApiRoute(router, '/:pid/state', middleware, [...middlewares, middleware.assertPost], 'put', controllers.write.posts.restore);
	setupApiRoute(router, '/:pid/state', middleware, [...middlewares, middleware.assertPost], 'delete', controllers.write.posts.delete);

	// app.route('/:pid/vote')
	// 	.post(apiMiddleware.requireUser, function(req, res) {
	// 		if (!utils.checkRequired(['delta'], req, res)) {
	// 			return false;
	// 		}

	// 		if (req.body.delta > 0) {
	// 			posts.upvote(req.params.pid, req.user.uid, function(err, data) {
	// 				errorHandler.handle(err, res, data);
	// 			})
	// 		} else if (req.body.delta < 0) {
	// 			posts.downvote(req.params.pid, req.user.uid, function(err, data) {
	// 				errorHandler.handle(err, res, data);
	// 			})
	// 		} else {
	// 			posts.unvote(req.params.pid, req.user.uid, function(err, data) {
	// 				errorHandler.handle(err, res, data);
	// 			})
	// 		}
	// 	})
	// 	.delete(apiMiddleware.requireUser, function(req, res) {
	// 		posts.unvote(req.params.pid, req.user.uid, function(err, data) {
	// 			errorHandler.handle(err, res, data);
	// 		})
	// 	});

	// app.route('/:pid/bookmark')
	// 	.post(apiMiddleware.requireUser, function(req, res) {
	// 		posts.bookmark(req.params.pid, req.user.uid, function (err) {
	// 			errorHandler.handle(err, res);
	// 		});
	// 	})
	// 	.delete(apiMiddleware.requireUser, apiMiddleware.validatePid, function (req, res) {
	// 		posts.unbookmark(req.params.pid, req.user.uid, function (err) {
	// 			errorHandler.handle(err, res);
	// 		});
	// 	});

	return router;
};
