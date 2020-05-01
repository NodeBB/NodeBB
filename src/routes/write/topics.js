'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;

module.exports = function () {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, '/', middleware, [...middlewares, middleware.checkRequired.bind(null, ['cid', 'title', 'content'])], 'post', controllers.write.topics.create);
	setupApiRoute(router, '/:tid', middleware, [...middlewares, middleware.checkRequired.bind(null, ['content']), middleware.assertTopic], 'post', controllers.write.topics.reply);
	// setupApiRoute(router, '/:cid', middleware, [...middlewares, middleware.isAdmin], 'put', controllers.write.categories.update);
	// setupApiRoute(router, '/:cid', middleware, [...middlewares, middleware.isAdmin], 'delete', controllers.write.categories.delete);

	// app.route('/:tid')
	// 	.delete(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
	// 		Topics.purgePostsAndTopic(req.params.tid, req.params._uid, function(err) {
	// 			errorHandler.handle(err, res);
	// 		});
	// 	})
	// 	.put(apiMiddleware.requireUser, function(req, res) {
	// 		if (!utils.checkRequired(['pid', 'content'], req, res)) {
	// 			return false;
	// 		}

	// 		var payload = {
	// 			uid: req.user.uid,
	// 			pid: req.body.pid,
	// 			content: req.body.content,
	// 			options: {}
	// 		};
	// 		console.log(payload);

	// 		// Maybe a "set if available" utils method may come in handy
	// 		if (req.body.handle) { payload.handle = req.body.handle; }
	// 		if (req.body.title) { payload.title = req.body.title; }
	// 		if (req.body.topic_thumb) { payload.options.topic_thumb = req.body.topic_thumb; }
	// 		if (req.body.tags) { payload.options.tags = req.body.tags; }

	// 		Posts.edit(payload, function(err, returnData) {
	// 			errorHandler.handle(err, res, returnData);
	// 		});
	// 	});

	// app.route('/:tid/state')
	// 	.put(apiMiddleware.requireUser, apiMiddleware.validateTid, function (req, res) {
	// 		Topics.restore(req.params.tid, req.params._uid, function (err) {
	// 			errorHandler.handle(err, res);
	// 		});
	// 	})
	// 	.delete(apiMiddleware.requireUser, apiMiddleware.validateTid, function (req, res) {
	// 		Topics.delete(req.params.tid, req.params._uid, function (err) {
	// 			errorHandler.handle(err, res);
	// 		});
	// 	});

	// app.route('/:tid/follow')
	// 	.put(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
	// 		Topics.follow(req.params.tid, req.user.uid, function(err) {
	// 			errorHandler.handle(err, res);
	// 		});
	// 	})
	// 	.delete(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
	// 		Topics.unfollow(req.params.tid, req.user.uid, function(err) {
	// 			errorHandler.handle(err, res);
	// 		});
	// 	});

	// app.route('/:tid/tags')
	// 	.put(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
	// 		if (!utils.checkRequired(['tags'], req, res)) {
	// 			return false;
	// 		}

	// 		Topics.createTags(req.body.tags, req.params.tid, Date.now(), function(err) {
	// 			errorHandler.handle(err, res);
	// 		});
	// 	})
	// 	.delete(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
	// 		Topics.deleteTopicTags(req.params.tid, function(err) {
	// 			errorHandler.handle(err, res);
	// 		});
	// 	});

	// app.route('/:tid/pin')
	// 	.put(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
	// 		Topics.tools.pin(req.params.tid, req.user.uid, function(err) {
	// 			errorHandler.handle(err, res);
	// 		});
	// 	})
	// 	.delete(apiMiddleware.requireUser, apiMiddleware.validateTid, function(req, res) {
	// 		Topics.tools.unpin(req.params.tid, req.user.uid, function(err) {
	// 			errorHandler.handle(err, res);
	// 		});
	// 	});

	return router;
};
