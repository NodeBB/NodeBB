'use strict';

const helpers = module.exports;
const winston = require('winston');
const middleware = require('../middleware');
const controllerHelpers = require('../controllers/helpers');

// router, name, middleware(deprecated), middlewares(optional), controller
helpers.setupPageRoute = function (...args) {
	const [router, name] = args;
	let middlewares = args.length > 3 ? args[args.length - 2] : [];
	const controller = args[args.length - 1];

	if (args.length === 5) {
		winston.warn(`[helpers.setupPageRoute(${name})] passing \`middleware\` as the third param is deprecated, it can now be safely removed`);
	}

	middlewares = [
		middleware.autoLocale,
		middleware.applyBlacklist,
		middleware.authenticateRequest,
		middleware.redirectToHomeIfBanned,
		middleware.maintenanceMode,
		middleware.registrationComplete,
		middleware.pluginHooks,
		...middlewares,
		middleware.pageView,
	];

	router.get(
		name,
		middleware.busyCheck,
		middlewares,
		middleware.buildHeader,
		helpers.tryRoute(controller)
	);
	router.get(`/api${name}`, middlewares, helpers.tryRoute(controller));
};

// router, name, middleware(deprecated), middlewares(optional), controller
helpers.setupAdminPageRoute = function (...args) {
	const [router, name] = args;
	const middlewares = args.length > 3 ? args[args.length - 2] : [];
	const controller = args[args.length - 1];
	if (args.length === 5) {
		winston.warn(`[helpers.setupAdminPageRoute(${name})] passing \`middleware\` as the third param is deprecated, it can now be safely removed`);
	}
	router.get(name, middleware.autoLocale, middleware.admin.buildHeader, middlewares, helpers.tryRoute(controller));
	router.get(`/api${name}`, middlewares, helpers.tryRoute(controller));
};

// router, verb, name, middlewares(optional), controller
helpers.setupApiRoute = function (...args) {
	const [router, verb, name] = args;
	let middlewares = args.length > 4 ? args[args.length - 2] : [];
	const controller = args[args.length - 1];

	middlewares = [
		middleware.autoLocale,
		middleware.applyBlacklist,
		middleware.authenticateRequest,
		middleware.maintenanceMode,
		middleware.registrationComplete,
		middleware.pluginHooks,
		middleware.logApiUsage,
		middleware.handleMultipart,
		...middlewares,
	];

	router[verb](name, middlewares, helpers.tryRoute(controller, (err, res) => {
		controllerHelpers.formatApiResponse(400, res, err);
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
