'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	const middlewares = [middleware.ensureLoggedIn, middleware.canChat];

	setupApiRoute(router, 'get', '/', [...middlewares], controllers.write.chats.list);
	setupApiRoute(router, 'post', '/', [...middlewares, middleware.checkRequired.bind(null, ['uids'])], controllers.write.chats.create);

	setupApiRoute(router, 'get', '/unread', [...middlewares], controllers.write.chats.getUnread);
	setupApiRoute(router, 'put', '/sort', [...middlewares, middleware.checkRequired.bind(null, ['roomIds', 'scores'])], controllers.write.chats.sortPublicRooms);

	setupApiRoute(router, 'head', '/:roomId', [...middlewares, middleware.assert.room], controllers.write.chats.exists);
	setupApiRoute(router, 'get', '/:roomId', [...middlewares, middleware.assert.room], controllers.write.chats.get);
	setupApiRoute(router, 'post', '/:roomId', [...middlewares, middleware.assert.room, middleware.checkRequired.bind(null, ['message'])], controllers.write.chats.post);
	setupApiRoute(router, 'put', '/:roomId', [...middlewares, middleware.assert.room], controllers.write.chats.update);

	setupApiRoute(router, 'put', '/:roomId/state', [...middlewares, middleware.assert.room], controllers.write.chats.mark);
	setupApiRoute(router, 'delete', '/:roomId/state', [...middlewares, middleware.assert.room], controllers.write.chats.mark);

	setupApiRoute(router, 'put', '/:roomId/watch', [...middlewares, middleware.assert.room, middleware.checkRequired.bind(null, ['value'])], controllers.write.chats.watch);
	setupApiRoute(router, 'delete', '/:roomId/watch', [...middlewares, middleware.assert.room], controllers.write.chats.watch);

	setupApiRoute(router, 'put', '/:roomId/typing', [...middlewares, middleware.assert.room], controllers.write.chats.toggleTyping);

	setupApiRoute(router, 'get', '/:roomId/users', [...middlewares, middleware.assert.room], controllers.write.chats.users);
	setupApiRoute(router, 'post', '/:roomId/users', [...middlewares, middleware.assert.room, middleware.checkRequired.bind(null, ['uids'])], controllers.write.chats.invite);
	setupApiRoute(router, 'delete', '/:roomId/users', [...middlewares, middleware.assert.room, middleware.checkRequired.bind(null, ['uids'])], controllers.write.chats.kick);
	setupApiRoute(router, 'delete', '/:roomId/users/:uid', [...middlewares, middleware.assert.room, middleware.assert.user], controllers.write.chats.kickUser);

	setupApiRoute(router, 'put', '/:roomId/owners/:uid', [...middlewares, middleware.assert.room, middleware.assert.user], controllers.write.chats.toggleOwner);
	setupApiRoute(router, 'delete', '/:roomId/owners/:uid', [...middlewares, middleware.assert.room, middleware.assert.user], controllers.write.chats.toggleOwner);

	setupApiRoute(router, 'get', '/:roomId/messages', [...middlewares, middleware.assert.room], controllers.write.chats.messages.list);
	setupApiRoute(router, 'get', '/:roomId/messages/pinned', [...middlewares, middleware.assert.room], controllers.write.chats.messages.getPinned);
	setupApiRoute(router, 'get', '/:roomId/messages/:mid', [...middlewares, middleware.assert.room, middleware.assert.message], controllers.write.chats.messages.get);
	setupApiRoute(router, 'put', '/:roomId/messages/:mid', [...middlewares, middleware.assert.room, middleware.assert.message], controllers.write.chats.messages.edit);
	setupApiRoute(router, 'post', '/:roomId/messages/:mid', [...middlewares, middleware.assert.room, middleware.assert.message], controllers.write.chats.messages.restore);
	setupApiRoute(router, 'delete', '/:roomId/messages/:mid', [...middlewares, middleware.assert.room, middleware.assert.message], controllers.write.chats.messages.delete);

	setupApiRoute(router, 'get', '/:roomId/messages/:mid/raw', [...middlewares, middleware.assert.room], controllers.write.chats.messages.getRaw);
	setupApiRoute(router, 'get', '/:roomId/messages/:mid/ip', [...middlewares, middleware.assert.room], controllers.write.chats.messages.getIpAddress);

	setupApiRoute(router, 'put', '/:roomId/messages/:mid/pin', [...middlewares, middleware.assert.room, middleware.assert.message], controllers.write.chats.messages.pin);
	setupApiRoute(router, 'delete', '/:roomId/messages/:mid/pin', [...middlewares, middleware.assert.room, middleware.assert.message], controllers.write.chats.messages.unpin);

	return router;
};
