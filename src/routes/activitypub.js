'use strict';

const helpers = require('./helpers');

module.exports = function (app, middleware, controllers) {
	helpers.setupPageRoute(app, '/world', [middleware.activitypub.enabled], controllers.activitypub.topics.list);
	helpers.setupPageRoute(app, '/world/:topic_id/:post_index?', [middleware.activitypub.enabled], controllers.activitypub.topics.get);

	/**
	 * These controllers only respond if the sender is making an json+activitypub style call (i.e. S2S-only)
	 *
	 * - See middleware.activitypub.assertS2S
	 */

	const middlewares = [middleware.activitypub.enabled, middleware.activitypub.assertS2S];

	app.get('/actor', middlewares, controllers.activitypub.actors.application);
	app.get('/uid/:uid', middlewares, controllers.activitypub.actors.user);
	app.get('/user/:userslug', [...middlewares, middleware.exposeUid], controllers.activitypub.actors.userBySlug);

	app.get('/uid/:uid/inbox', middlewares, controllers.activitypub.getInbox);
	app.post('/uid/:uid/inbox', [...middlewares, middleware.activitypub.validate], controllers.activitypub.postInbox);

	app.get('/uid/:uid/outbox', middlewares, controllers.activitypub.getOutbox);
	app.post('/uid/:uid/outbox', middlewares, controllers.activitypub.postOutbox);

	app.get('/uid/:uid/following', middlewares, controllers.activitypub.getFollowing);
	app.get('/uid/:uid/followers', middlewares, controllers.activitypub.getFollowers);

	app.get('/post/:pid', middlewares, controllers.activitypub.actors.note);
};
