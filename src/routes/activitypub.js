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

	const middlewares = [middleware.activitypub.enabled, middleware.activitypub.assertS2S, middleware.exposeUid];

	app.get('/actor', middlewares, controllers.activitypub.actors.application);
	app.get('/uid/:uid', [middleware.activitypub.enabled, middleware.activitypub.assertS2S], controllers.activitypub.actors.user);
	app.get('/user/:userslug', middlewares, controllers.activitypub.actors.userBySlug);

	app.get('/user/:userslug/inbox', middlewares, controllers.activitypub.getInbox);
	app.post('/user/:userslug/inbox', [...middlewares, middleware.activitypub.validate], controllers.activitypub.postInbox);

	app.get('/user/:userslug/outbox', middlewares, controllers.activitypub.getOutbox);
	app.post('/user/:userslug/outbox', middlewares, controllers.activitypub.postOutbox);

	app.get('/user/:userslug/following', middlewares, controllers.activitypub.getFollowing);
	app.get('/user/:userslug/followers', middlewares, controllers.activitypub.getFollowers);
};
