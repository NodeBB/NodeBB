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

	setupApiRoute(router, '/:pid/vote', middleware, [...middlewares, middleware.checkRequired.bind(null, ['delta']), middleware.assertPost], 'put', controllers.write.posts.vote);
	setupApiRoute(router, '/:pid/vote', middleware, [...middlewares, middleware.assertPost], 'delete', controllers.write.posts.unvote);

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
