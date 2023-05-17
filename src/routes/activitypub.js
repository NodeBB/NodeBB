'use strict';

module.exports = function (app, middleware, controllers) {
	const middlewares = [middleware.proceedOnActivityPub, middleware.exposeUid];

	app.get('/user/:userslug', middlewares, controllers.activitypub.getActor);
};
