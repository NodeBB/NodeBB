'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;

module.exports = function () {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, '/:pid', middleware, [...middlewares, middleware.checkRequired.bind(null, ['content'])], 'put', controllers.write.posts.edit);

	// app.route('/:pid')
	// 	.put(apiMiddleware.requireUser, function(req, res) {
	// 		if (!utils.checkRequired(['content'], req, res)) {
	// 			return false;
	// 		}

	// 		var payload = {
	// 			uid: req.user.uid,
	// 			pid: req.params.pid,
	// 			content: req.body.content,
	// 			options: {}
	// 		};

	// 		if (req.body.handle) { payload.handle = req.body.handle; }
	// 		if (req.body.title) { payload.title = req.body.title; }
	// 		if (req.body.topic_thumb) { payload.options.topic_thumb = req.body.topic_thumb; }
	// 		if (req.body.tags) { payload.options.tags = req.body.tags; }

	// 		posts.edit(payload, function(err) {
	// 			errorHandler.handle(err, res);
	// 		})
	// 	})
	// 	.delete(apiMiddleware.requireUser, apiMiddleware.validatePid, function(req, res) {
	// 		posts.purge(req.params.pid, req.user.uid, function(err) {
	// 			errorHandler.handle(err, res);
	// 		});
	// 	});

	// app.route('/:pid/state')
	// 	.put(apiMiddleware.requireUser, apiMiddleware.validatePid, function (req, res) {
	// 		posts.restore(req.params.pid, req.user.uid, function (err) {
	// 			errorHandler.handle(err, res);
	// 		});
	// 	})
	// 	.delete(apiMiddleware.requireUser, apiMiddleware.validatePid, function (req, res) {
	// 		posts.delete(req.params.pid, req.user.uid, function (err) {
	// 			errorHandler.handle(err, res);
	// 		});
	// 	});

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
