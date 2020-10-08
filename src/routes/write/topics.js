'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;

module.exports = function () {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, '/', middleware, [...middlewares, middleware.checkRequired.bind(null, ['cid', 'title', 'content'])], 'post', controllers.write.topics.create);
	setupApiRoute(router, '/:tid', middleware, [...middlewares, middleware.checkRequired.bind(null, ['content']), middleware.assert.topic], 'post', controllers.write.topics.reply);
	setupApiRoute(router, '/:tid', middleware, [...middlewares, middleware.assert.topic], 'delete', controllers.write.topics.purge);

	setupApiRoute(router, '/:tid/state', middleware, [...middlewares, middleware.assert.topic], 'put', controllers.write.topics.restore);
	setupApiRoute(router, '/:tid/state', middleware, [...middlewares, middleware.assert.topic], 'delete', controllers.write.topics.delete);

	setupApiRoute(router, '/:tid/pin', middleware, [...middlewares, middleware.assert.topic], 'put', controllers.write.topics.pin);
	setupApiRoute(router, '/:tid/pin', middleware, [...middlewares, middleware.assert.topic], 'delete', controllers.write.topics.unpin);

	setupApiRoute(router, '/:tid/lock', middleware, [...middlewares, middleware.assert.topic], 'put', controllers.write.topics.lock);
	setupApiRoute(router, '/:tid/lock', middleware, [...middlewares, middleware.assert.topic], 'delete', controllers.write.topics.unlock);

	setupApiRoute(router, '/:tid/follow', middleware, [...middlewares, middleware.assert.topic], 'put', controllers.write.topics.follow);
	setupApiRoute(router, '/:tid/follow', middleware, [...middlewares, middleware.assert.topic], 'delete', controllers.write.topics.unfollow);
	setupApiRoute(router, '/:tid/ignore', middleware, [...middlewares, middleware.assert.topic], 'put', controllers.write.topics.ignore);
	setupApiRoute(router, '/:tid/ignore', middleware, [...middlewares, middleware.assert.topic], 'delete', controllers.write.topics.unfollow);	// intentional, unignore == unfollow

	setupApiRoute(router, '/:tid/tags', middleware, [...middlewares, middleware.checkRequired.bind(null, ['tags']), middleware.assert.topic], 'put', controllers.write.topics.addTags);
	setupApiRoute(router, '/:tid/tags', middleware, [...middlewares, middleware.assert.topic], 'delete', controllers.write.topics.deleteTags);

	return router;
};
