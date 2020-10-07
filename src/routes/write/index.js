'use strict';

const middleware = require('../../middleware');
const helpers = require('../../controllers/helpers');

const Write = module.exports;

Write.reload = (params) => {
	const router = params.router;

	router.use('/api/v3', function (req, res, next) {
		// if (req.protocol !== 'https') {
		// 	res.set('Upgrade', 'TLS/1.0, HTTP/1.1');
		// 	return helpers.formatApiResponse(426, res);
		// } else {
		// 	next();
		// }

		res.locals.isAPI = true;
		next();
	});

	router.use('/api/v3/users', require('./users')());
	router.use('/api/v3/groups', require('./groups')());
	router.use('/api/v3/categories', require('./categories')());
	router.use('/api/v3/topics', require('./topics')());
	router.use('/api/v3/posts', require('./posts')());
	router.use('/api/v3/admin', require('./admin')());

	router.get('/api/v3/ping', function (req, res) {
		helpers.formatApiResponse(200, res, {
			pong: true,
		});
	});

	router.post('/api/v3/ping', middleware.authenticate, function (req, res) {
		helpers.formatApiResponse(200, res, {
			uid: req.user.uid,
		});
	});

	// This router is reserved exclusively for plugins to add their own routes into the write api plugin. Confused yet? :trollface:
	// var customRouter = require('express').Router();
	// plugins.fireHook('filter:plugin.write-api.routes', {
	// 	router: customRouter,
	// 	apiMiddleware: apiMiddleware,
	// 	middleware: coreMiddleware,
	// 	errorHandler: errorHandler
	// }, function (err, payload) {
	// 	router.use('/', payload.router);

	// 	router.use(function(req, res) {
	// 		// Catch-all
	// 		errorHandler.respond(404, res);
	// 	});
	// });
};
