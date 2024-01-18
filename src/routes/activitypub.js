'use strict';

const helpers = require('./helpers');

module.exports = function (app, middleware, controllers) {
	helpers.setupPageRoute(app, '/world/:view?', [middleware.activitypub.enabled], controllers.activitypub.topics.list);

	/**
	 * These controllers only respond if the sender is making an json+activitypub style call (i.e. S2S-only)
	 *
	 * - See middleware.activitypub.assertS2S
	 */

	const middlewares = [middleware.activitypub.enabled, middleware.activitypub.assertS2S, middleware.exposeUid];

	app.get('/user/:userslug', middlewares, controllers.activitypub.getActor);

	app.get('/user/:userslug/inbox', middlewares, controllers.activitypub.getInbox);
	app.post('/user/:userslug/inbox', [...middlewares, middleware.activitypub.validate], controllers.activitypub.postInbox);

	app.get('/user/:userslug/outbox', middlewares, controllers.activitypub.getOutbox);
	app.post('/user/:userslug/outbox', middlewares, controllers.activitypub.postOutbox);

	app.get('/user/:userslug/following', middlewares, controllers.activitypub.getFollowing);
	app.get('/user/:userslug/followers', middlewares, controllers.activitypub.getFollowers);
};
