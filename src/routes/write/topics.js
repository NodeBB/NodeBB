'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	const middlewares = [middleware.ensureLoggedIn];

	const multipart = require('connect-multiparty');
	const multipartMiddleware = multipart();

	setupApiRoute(router, 'post', '/', [middleware.checkRequired.bind(null, ['cid', 'title', 'content'])], controllers.write.topics.create);
	setupApiRoute(router, 'get', '/:tid', [], controllers.write.topics.get);
	setupApiRoute(router, 'post', '/:tid', [middleware.checkRequired.bind(null, ['content']), middleware.assert.topic], controllers.write.topics.reply);
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
	setupApiRoute(router, 'delete', '/:tid/ignore', [...middlewares, middleware.assert.topic], controllers.write.topics.unfollow); // intentional, unignore == unfollow

	setupApiRoute(router, 'put', '/:tid/tags', [...middlewares, middleware.checkRequired.bind(null, ['tags']), middleware.assert.topic], controllers.write.topics.updateTags);
	setupApiRoute(router, 'patch', '/:tid/tags', [...middlewares, middleware.checkRequired.bind(null, ['tags']), middleware.assert.topic], controllers.write.topics.addTags);
	setupApiRoute(router, 'delete', '/:tid/tags', [...middlewares, middleware.assert.topic], controllers.write.topics.deleteTags);

	setupApiRoute(router, 'get', '/:tid/thumbs', [], controllers.write.topics.getThumbs);
	setupApiRoute(router, 'post', '/:tid/thumbs', [multipartMiddleware, middleware.validateFiles, middleware.uploads.ratelimit, ...middlewares], controllers.write.topics.addThumb);
	setupApiRoute(router, 'put', '/:tid/thumbs', [...middlewares, middleware.checkRequired.bind(null, ['tid'])], controllers.write.topics.migrateThumbs);
	setupApiRoute(router, 'delete', '/:tid/thumbs', [...middlewares, middleware.checkRequired.bind(null, ['path'])], controllers.write.topics.deleteThumb);
	setupApiRoute(router, 'put', '/:tid/thumbs/order', [...middlewares, middleware.checkRequired.bind(null, ['path', 'order'])], controllers.write.topics.reorderThumbs);

	setupApiRoute(router, 'get', '/:tid/events', [middleware.assert.topic], controllers.write.topics.getEvents);
	setupApiRoute(router, 'delete', '/:tid/events/:eventId', [middleware.assert.topic], controllers.write.topics.deleteEvent);

	setupApiRoute(router, 'put', '/:tid/read', [...middlewares, middleware.assert.topic], controllers.write.topics.markRead);
	setupApiRoute(router, 'delete', '/:tid/read', [...middlewares, middleware.assert.topic], controllers.write.topics.markUnread);
	setupApiRoute(router, 'put', '/:tid/bump', [...middlewares, middleware.assert.topic], controllers.write.topics.bump);

	return router;
};
