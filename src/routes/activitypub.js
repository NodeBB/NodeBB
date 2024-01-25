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

	app.get('/user/:userslug/inbox', [...middlewares, middleware.exposeUid], controllers.activitypub.getInbox);
	app.post('/user/:userslug/inbox', [...middlewares, middleware.activitypub.validate, middleware.exposeUid], controllers.activitypub.postInbox);

	app.get('/user/:userslug/outbox', [...middlewares, middleware.exposeUid], controllers.activitypub.getOutbox);
	app.post('/user/:userslug/outbox', [...middlewares, middleware.exposeUid], controllers.activitypub.postOutbox);

	app.get('/user/:userslug/following', [...middlewares, middleware.exposeUid], controllers.activitypub.getFollowing);
	app.get('/user/:userslug/followers', [...middlewares, middleware.exposeUid], controllers.activitypub.getFollowers);

	app.get('/post/:pid', middlewares, controllers.activitypub.actors.note);
};
