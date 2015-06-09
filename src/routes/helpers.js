'use strict';

var helpers = {};

helpers.setupPageRoute = function(router, name, middleware, middlewares, controller) {
	middlewares = middlewares.concat([middleware.pageView]);

	router.get(name, middleware.buildHeader, middlewares, controller);
	router.get('/api' + name, middlewares, controller);
};

module.exports = helpers;