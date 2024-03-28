'use strict';

const helpers = require('./helpers');

module.exports = function (app, middleware, controllers) {
	helpers.setupPageRoute(app, '/world/:filter?', [middleware.activitypub.enabled], controllers.activitypub.topics.list);

	/**
	 * These controllers only respond if the sender is making an json+activitypub style call (i.e. S2S-only)
	 *
	 * - See middleware.activitypub.assertS2S
	 */

	const middlewares = [
		middleware.activitypub.enabled,
		middleware.activitypub.assertS2S,
		middleware.activitypub.configureResponse,
	];

	app.get('/actor', middlewares, controllers.activitypub.actors.application);
	app.post('/inbox', [...middlewares, middleware.activitypub.validate], controllers.activitypub.postInbox);

	app.get('/uid/:uid', [...middlewares, middleware.assert.user], controllers.activitypub.actors.user);
	app.get('/user/:userslug', [...middlewares, middleware.exposeUid, middleware.assert.user], controllers.activitypub.actors.userBySlug);
	app.get('/uid/:uid/inbox', [...middlewares, middleware.assert.user], controllers.activitypub.getInbox);
	app.post('/uid/:uid/inbox', [...middlewares, middleware.assert.user, middleware.activitypub.validate], controllers.activitypub.postInbox);
	app.get('/uid/:uid/outbox', [...middlewares, middleware.assert.user], controllers.activitypub.getOutbox);
	app.post('/uid/:uid/outbox', [...middlewares, middleware.assert.user], controllers.activitypub.postOutbox);
	app.get('/uid/:uid/following', [...middlewares, middleware.assert.user], controllers.activitypub.getFollowing);
	app.get('/uid/:uid/followers', [...middlewares, middleware.assert.user], controllers.activitypub.getFollowers);

	app.get('/post/:pid', [...middlewares, middleware.assert.post], controllers.activitypub.actors.note);

	app.get('/topic/:tid/:slug?', [...middlewares, middleware.assert.topic], controllers.activitypub.actors.topic);

	app.get('/category/:cid/:slug?', [...middlewares, middleware.assert.category], controllers.activitypub.actors.category);
	app.get('/category/:cid/inbox', [...middlewares, middleware.assert.category], controllers.activitypub.getInbox);
	app.post('/category/:cid/inbox', [...middlewares, middleware.assert.category, middleware.activitypub.validate], controllers.activitypub.postInbox);
	app.get('/category/:cid/outbox', [...middlewares, middleware.assert.category], controllers.activitypub.getCategoryOutbox);
	app.post('/category/:cid/outbox', [...middlewares, middleware.assert.category], controllers.activitypub.postOutbox);
};
