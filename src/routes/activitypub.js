'use strict';

module.exports = function (app, middleware, controllers) {
	const middlewares = [middleware.proceedOnActivityPub, middleware.exposeUid];

	app.get('/user/:userslug', middlewares, controllers.activitypub.getActor);

	app.get('/user/:userslug/outbox', middlewares, controllers.activitypub.getOutbox);
	app.post('/user/:userslug/outbox', middlewares, controllers.activitypub.postOutbox);

	app.get('/user/:userslug/inbox', middlewares, controllers.activitypub.getInbox);
	app.post('/user/:userslug/inbox', middlewares, controllers.activitypub.postInbox);
};
