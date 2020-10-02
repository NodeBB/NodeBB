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
	setupApiRoute(router, '/:tid', middleware, [...middlewares, middleware.assertTopic], 'delete', controllers.write.topics.purge);

	setupApiRoute(router, '/:tid/state', middleware, [...middlewares, middleware.assertTopic], 'put', controllers.write.topics.restore);
	setupApiRoute(router, '/:tid/state', middleware, [...middlewares, middleware.assertTopic], 'delete', controllers.write.topics.delete);

	setupApiRoute(router, '/:tid/pin', middleware, [...middlewares, middleware.assertTopic], 'put', controllers.write.topics.pin);
	setupApiRoute(router, '/:tid/pin', middleware, [...middlewares, middleware.assertTopic], 'delete', controllers.write.topics.unpin);

	setupApiRoute(router, '/:tid/lock', middleware, [...middlewares, middleware.assertTopic], 'put', controllers.write.topics.lock);
	setupApiRoute(router, '/:tid/lock', middleware, [...middlewares, middleware.assertTopic], 'delete', controllers.write.topics.unlock);


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

	return router;
};
