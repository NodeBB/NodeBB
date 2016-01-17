'use strict';

var helpers = {};

helpers.setupPageRoute = function(router, name, middleware, middlewares, controller) {
	middlewares = middlewares.concat([middleware.pageView, middleware.pluginHooks]);

	router.get(name, middleware.busyCheck, middleware.buildHeader, middlewares, controller);
	router.get('/api' + name, middlewares, controller);
};

module.exports = helpers;