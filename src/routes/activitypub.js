'use strict';

const helpers = require('./helpers');

module.exports = function (app, middleware, controllers) {
	helpers.setupPageRoute(app, '/world', [
		middleware.activitypub.enabled,
		middleware.activitypub.pageview,
	], controllers.activitypub.topics.list);
	helpers.setupPageRoute(app, '/ap', [
		middleware.activitypub.enabled,
		middleware.activitypub.pageview,
	], controllers.activitypub.fetch);

	/**
	 * The following controllers only respond if the sender is making an json+activitypub style call (i.e. S2S-only)
	 *
	 * - See middleware.activitypub.assertS2S
	 */

	const middlewares = [
		middleware.activitypub.enabled,
		middleware.activitypub.pageview,
		middleware.activitypub.assertS2S,
		middleware.activitypub.verify,
		middleware.activitypub.configureResponse,
	];

	const inboxMiddlewares = [
		middleware.activitypub.assertPayload,
		middleware.activitypub.resolveObjects,
		middleware.activitypub.normalize,
	];

	app.get('/actor', middlewares, helpers.tryRoute(controllers.activitypub.actors.application));
	app.post('/inbox', [...middlewares, ...inboxMiddlewares], helpers.tryRoute(controllers.activitypub.postInbox));

	app.get('/uid/:uid', [...middlewares, middleware.assert.user], helpers.tryRoute(controllers.activitypub.actors.user));
	app.get('/user/:userslug', [...middlewares, middleware.exposeUid, middleware.assert.user], helpers.tryRoute(controllers.activitypub.actors.userBySlug));
	app.get('/uid/:uid/inbox', [...middlewares, middleware.assert.user], helpers.tryRoute(controllers.activitypub.getInbox));
	app.post('/uid/:uid/inbox', [...middlewares, middleware.assert.user, ...inboxMiddlewares], helpers.tryRoute(controllers.activitypub.postInbox));
	app.get('/uid/:uid/outbox', [...middlewares, middleware.assert.user], helpers.tryRoute(controllers.activitypub.getOutbox));
	app.post('/uid/:uid/outbox', [...middlewares, middleware.assert.user], helpers.tryRoute(controllers.activitypub.postOutbox));
	app.get('/uid/:uid/following', [...middlewares, middleware.assert.user], helpers.tryRoute(controllers.activitypub.getFollowing));
	app.get('/uid/:uid/followers', [...middlewares, middleware.assert.user], helpers.tryRoute(controllers.activitypub.getFollowers));

	app.get('/post/:pid', [...middlewares, middleware.assert.post], helpers.tryRoute(controllers.activitypub.actors.note));
	app.get('/post/:pid/replies', [...middlewares, middleware.assert.post], helpers.tryRoute(controllers.activitypub.actors.replies));

	app.get('/topic/:tid/:slug?', [...middlewares, middleware.assert.topic], helpers.tryRoute(controllers.activitypub.actors.topic));

	app.get('/category/:cid/inbox', [...middlewares, middleware.assert.category], helpers.tryRoute(controllers.activitypub.getInbox));
	app.post('/category/:cid/inbox', [...inboxMiddlewares, middleware.assert.category, ...inboxMiddlewares], helpers.tryRoute(controllers.activitypub).postInbox);
	app.get('/category/:cid/outbox', [...middlewares, middleware.assert.category], helpers.tryRoute(controllers.activitypub.getCategoryOutbox));
	app.post('/category/:cid/outbox', [...middlewares, middleware.assert.category], helpers.tryRoute(controllers.activitypub.postOutbox));
	app.get('/category/:cid/:slug?', [...middlewares, middleware.assert.category], helpers.tryRoute(controllers.activitypub.actors.category));

	app.get('/message/:mid', [...middlewares, middleware.assert.message], helpers.tryRoute(controllers.activitypub.actors.message));
};
