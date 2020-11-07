'use strict';

const nconf = require('nconf');
const winston = require('winston');
const plugins = require('../../plugins');
const middleware = require('../../middleware');
const helpers = require('../../controllers/helpers');

const Write = module.exports;

Write.reload = async (params) => {
	const router = params.router;

	router.use('/api/v3', function (req, res, next) {
		// Require https if configured so
		if (nconf.get('secure') && req.protocol !== 'https') {
			res.set('Upgrade', 'TLS/1.0, HTTP/1.1');
			return helpers.formatApiResponse(426, res);
		}

		res.locals.isAPI = true;
		next();
	});

	router.use('/api/v3/users', require('./users')());
	router.use('/api/v3/groups', require('./groups')());
	router.use('/api/v3/categories', require('./categories')());
	router.use('/api/v3/topics', require('./topics')());
	router.use('/api/v3/posts', require('./posts')());
	router.use('/api/v3/admin', require('./admin')());
	router.use('/api/v3/files', require('./files')());

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

	/**
	 * Plugins can add routes to the Write API by attaching a listener to the
	 * below hook. The hooks added to the passed-in router will be mounted to
	 * `/api/v3/plugins`.
	 */
	const pluginRouter = require('express').Router();
	await plugins.fireHook('static:api.routes', {
		router: pluginRouter,
		middleware,
		helpers,
	});
	winston.info(`[api] Adding ${pluginRouter.stack.length} route(s) to \`api/v3/plugins\``);
	router.use('/api/v3/plugins', pluginRouter);

	// 404 handling
	router.use('/api/v3', (req, res) => {
		helpers.formatApiResponse(404, res);
	});
};
