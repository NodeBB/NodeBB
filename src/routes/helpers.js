'use strict';

var helpers = module.exports;

helpers.setupPageRoute = function (router, name, middleware, middlewares, controller) {
	middlewares = [middleware.maintenanceMode, middleware.registrationComplete, middleware.pageView, middleware.pluginHooks].concat(middlewares);
	middlewares = middlewares.map(m => helpers.tryRoute(m));

	router.get(name, helpers.tryRoute(middleware.busyCheck), helpers.tryRoute(middleware.buildHeader), middlewares, helpers.tryRoute(controller));
	router.get('/api' + name, middlewares, helpers.tryRoute(controller));
};

helpers.setupAdminPageRoute = function (router, name, middleware, middlewares, controller) {
	middlewares = middlewares.map(m => helpers.tryRoute(m));
	router.get(name, helpers.tryRoute(middleware.admin.buildHeader), middlewares, helpers.tryRoute(controller));
	router.get('/api' + name, middlewares, helpers.tryRoute(controller));
};

helpers.setupAPIRoute = function (router, name, middlewares, controller) {
	middlewares = middlewares.map(m => helpers.tryRoute(m));
	router.get(name, middlewares, helpers.tryRoute(controller));
};

helpers.tryRoute = function (controller) {
	if (controller && controller.constructor && controller.constructor.name === 'AsyncFunction') {
		return async function (req, res, next) {
			try {
				await controller(req, res, next);
			} catch (err) {
				next(err);
			}
		};
	}
	return controller;
};
