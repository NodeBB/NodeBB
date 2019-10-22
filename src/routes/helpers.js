'use strict';

var helpers = module.exports;

helpers.setupPageRoute = function (router, name, middleware, middlewares, controller) {
	middlewares = [middleware.maintenanceMode, middleware.registrationComplete, middleware.pageView, middleware.pluginHooks].concat(middlewares);

	async function tryRoute(req, res, next) {
		if (controller && controller.constructor && controller.constructor.name === 'AsyncFunction') {
			try {
				return await controller(req, res, next);
			} catch (err) {
				return next(err);
			}
		}
		controller(req, res, next);
	}

	router.get(name, middleware.busyCheck, middleware.buildHeader, middlewares, tryRoute);
	router.get('/api' + name, middlewares, tryRoute);
};

helpers.setupAdminPageRoute = function (router, name, middleware, middlewares, controller) {
	router.get(name, middleware.admin.buildHeader, middlewares, controller);
	router.get('/api' + name, middlewares, controller);
};
