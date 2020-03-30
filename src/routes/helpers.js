'use strict';

var helpers = module.exports;

helpers.setupPageRoute = function (router, name, middleware, middlewares, controller) {
	middlewares = [middleware.maintenanceMode, middleware.registrationComplete, middleware.pageView, middleware.pluginHooks].concat(middlewares);

	router.get(name, middleware.busyCheck, middleware.applyCSRF, middleware.buildHeader, middlewares, helpers.tryRoute(controller));
	router.get('/api' + name, middlewares, helpers.tryRoute(controller));
};

helpers.setupAdminPageRoute = function (router, name, middleware, middlewares, controller) {
	router.get(name, middleware.admin.buildHeader, middlewares, helpers.tryRoute(controller));
	router.get('/api' + name, middlewares, helpers.tryRoute(controller));
};

helpers.setupApiRoute = function (router, name, middleware, middlewares, verb, controller) {
	router[verb](name, middleware.authenticate, middlewares, helpers.tryRoute(controller, (err, res) => {
		helpers.formatApiResponse(400, res, err);
	}));
};

helpers.tryRoute = function (controller, handler) {
	// `handler` is optional
	if (controller && controller.constructor && controller.constructor.name === 'AsyncFunction') {
		return async function (req, res, next) {
			try {
				await controller(req, res, next);
			} catch (err) {
				if (handler) {
					return handler(err, res);
				}

				next(err);
			}
		};
	}
	return controller;
};
