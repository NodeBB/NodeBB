'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const setupApiRoute = routeHelpers.setupApiRoute;

module.exports = function () {
	const middlewares = [middleware.authenticate];

	setupApiRoute(router, 'post', '/', [...middlewares, middleware.checkRequired.bind(null, ['cid', 'title', 'content'])], controllers.write.topics.create);
	setupApiRoute(router, 'post', '/:tid', [...middlewares, middleware.checkRequired.bind(null, ['content']), middleware.assert.topic], controllers.write.topics.reply);
	setupApiRoute(router, 'delete', '/:tid', [...middlewares], controllers.write.topics.purge);

	setupApiRoute(router, 'put', '/:tid/state', [...middlewares], controllers.write.topics.restore);
	setupApiRoute(router, 'delete', '/:tid/state', [...middlewares], controllers.write.topics.delete);

	setupApiRoute(router, 'put', '/:tid/pin', [...middlewares, middleware.assert.topic], controllers.write.topics.pin);
	setupApiRoute(router, 'delete', '/:tid/pin', [...middlewares], controllers.write.topics.unpin);

	setupApiRoute(router, 'put', '/:tid/lock', [...middlewares], controllers.write.topics.lock);
	setupApiRoute(router, 'delete', '/:tid/lock', [...middlewares], controllers.write.topics.unlock);

	setupApiRoute(router, 'put', '/:tid/follow', [...middlewares, middleware.assert.topic], controllers.write.topics.follow);
	setupApiRoute(router, 'delete', '/:tid/follow', [...middlewares, middleware.assert.topic], controllers.write.topics.unfollow);
	setupApiRoute(router, 'put', '/:tid/ignore', [...middlewares, middleware.assert.topic], controllers.write.topics.ignore);
	setupApiRoute(router, 'delete', '/:tid/ignore', [...middlewares, middleware.assert.topic], controllers.write.topics.unfollow);	// intentional, unignore == unfollow

	setupApiRoute(router, 'put', '/:tid/tags', [...middlewares, middleware.checkRequired.bind(null, ['tags']), middleware.assert.topic], controllers.write.topics.addTags);
	setupApiRoute(router, 'delete', '/:tid/tags', [...middlewares, middleware.assert.topic], controllers.write.topics.deleteTags);

	return router;
};
