"use strict";

var nconf = require('nconf'),
	path = require('path'),
	async = require('async'),
	winston = require('winston'),
	controllers = require('../controllers'),
	plugins = require('../plugins'),
	express = require('express'),
	validator = require('validator'),

	accountRoutes = require('./accounts'),

	metaRoutes = require('./meta'),
	apiRoutes = require('./api'),
	adminRoutes = require('./admin'),
	feedRoutes = require('./feeds'),
	pluginRoutes = require('./plugins'),
	authRoutes = require('./authentication'),
	helpers = require('./helpers');

var setupPageRoute = helpers.setupPageRoute;

function mainRoutes(app, middleware, controllers) {
	setupPageRoute(app, '/', middleware, [], controllers.home);

	var loginRegisterMiddleware = [middleware.redirectToAccountIfLoggedIn];

	setupPageRoute(app, '/login', middleware, loginRegisterMiddleware, controllers.login);
	setupPageRoute(app, '/register', middleware, loginRegisterMiddleware, controllers.register);
	setupPageRoute(app, '/compose', middleware, [], controllers.compose);
	setupPageRoute(app, '/confirm/:code', middleware, [], controllers.confirmEmail);
	setupPageRoute(app, '/outgoing', middleware, [], controllers.outgoing);
	setupPageRoute(app, '/search/:term?', middleware, [], controllers.search.search);
	setupPageRoute(app, '/reset/:code?', middleware, [], controllers.reset);
	setupPageRoute(app, '/tos', middleware, [], controllers.termsOfUse);
}

function globalModRoutes(app, middleware, controllers) {
	setupPageRoute(app, '/ip-blacklist', middleware, [], controllers.globalMods.ipBlacklist);
	setupPageRoute(app, '/posts/flags', middleware, [], controllers.globalMods.flagged);
}

function topicRoutes(app, middleware, controllers) {
	setupPageRoute(app, '/topic/:topic_id/:slug/:post_index?', middleware, [], controllers.topics.get);
	setupPageRoute(app, '/topic/:topic_id/:slug?', middleware, [], controllers.topics.get);
}

function tagRoutes(app, middleware, controllers) {
	setupPageRoute(app, '/tags/:tag', middleware, [middleware.privateTagListing], controllers.tags.getTag);
	setupPageRoute(app, '/tags', middleware, [middleware.privateTagListing], controllers.tags.getTags);
}

function categoryRoutes(app, middleware, controllers) {
	setupPageRoute(app, '/categories', middleware, [], controllers.categories.list);
	setupPageRoute(app, '/popular/:term?', middleware, [], controllers.popular.get);
	setupPageRoute(app, '/recent', middleware, [], controllers.recent.get);
	setupPageRoute(app, '/unread/:filter?', middleware, [middleware.authenticate], controllers.unread.get);

	setupPageRoute(app, '/category/:category_id/:slug/:topic_index', middleware, [], controllers.category.get);
	setupPageRoute(app, '/category/:category_id/:slug?', middleware, [], controllers.category.get);
}

function userRoutes(app, middleware, controllers) {
	var middlewares = [middleware.checkGlobalPrivacySettings];

	setupPageRoute(app, '/users', middleware, middlewares, controllers.users.getUsersSortedByJoinDate);
	setupPageRoute(app, '/users/online', middleware, middlewares, controllers.users.getOnlineUsers);
	setupPageRoute(app, '/users/sort-posts', middleware, middlewares, controllers.users.getUsersSortedByPosts);
	setupPageRoute(app, '/users/sort-reputation', middleware, middlewares, controllers.users.getUsersSortedByReputation);
	setupPageRoute(app, '/users/banned', middleware, middlewares, controllers.users.getBannedUsers);
}


function groupRoutes(app, middleware, controllers) {
	var middlewares = [middleware.checkGlobalPrivacySettings, middleware.exposeGroupName];

	setupPageRoute(app, '/groups', middleware, middlewares, controllers.groups.list);
	setupPageRoute(app, '/groups/:slug', middleware, middlewares, controllers.groups.details);
	setupPageRoute(app, '/groups/:slug/members', middleware, middlewares, controllers.groups.members);
}

module.exports = function(app, middleware, hotswapIds) {
	var routers = [
			express.Router(),	// plugin router
			express.Router(),	// main app router
			express.Router()	// auth router
		],
		router = routers[1],
		pluginRouter = routers[0],
		authRouter = routers[2],
		relativePath = nconf.get('relative_path'),
		ensureLoggedIn = require('connect-ensure-login');

	if (Array.isArray(hotswapIds) && hotswapIds.length) {
		for(var idx,x=0;x<hotswapIds.length;x++) {
			idx = routers.push(express.Router()) - 1;
			routers[idx].hotswapId = hotswapIds[x];
		}
	}

	pluginRouter.render = function() {
		app.render.apply(app, arguments);
	};
	controllers.render = function() {
		app.render.apply(app, arguments);
	};

	// Set-up for hotswapping (when NodeBB reloads)
	pluginRouter.hotswapId = 'plugins';
	authRouter.hotswapId = 'auth';

	app.use(middleware.maintenanceMode);

	app.all(relativePath + '(/api|/api/*?)', middleware.prepareAPI);
	app.all(relativePath + '(/api/admin|/api/admin/*?)', middleware.isAdmin);
	app.all(relativePath + '(/admin|/admin/*?)', ensureLoggedIn.ensureLoggedIn(nconf.get('relative_path') + '/login?local=1'), middleware.applyCSRF, middleware.isAdmin);

	adminRoutes(router, middleware, controllers);
	metaRoutes(router, middleware, controllers);
	apiRoutes(router, middleware, controllers);
	feedRoutes(router, middleware, controllers);
	pluginRoutes(router, middleware, controllers);

	mainRoutes(router, middleware, controllers);
	topicRoutes(router, middleware, controllers);
	globalModRoutes(router, middleware, controllers);
	tagRoutes(router, middleware, controllers);
	categoryRoutes(router, middleware, controllers);
	accountRoutes(router, middleware, controllers);
	userRoutes(router, middleware, controllers);
	groupRoutes(router, middleware, controllers);

	for(var x=0;x<routers.length;x++) {
		app.use(relativePath, routers[x]);
	}

	if (process.env.NODE_ENV === 'development') {
		require('./debug')(app, middleware, controllers);
	}

	app.use(middleware.privateUploads);

	app.use(relativePath, express.static(path.join(__dirname, '../../', 'public'), {
		maxAge: app.enabled('cache') ? 5184000000 : 0
	}));

	handle404(app, middleware);
	handleErrors(app, middleware);


	// Add plugin routes
	async.series([
		async.apply(plugins.reloadRoutes),
		async.apply(authRoutes.reloadRoutes)
	]);
};

function handle404(app, middleware) {
	var relativePath = nconf.get('relative_path');
	var isLanguage = new RegExp('^' + relativePath + '/language/.*/.*.json');
	var isClientScript = new RegExp('^' + relativePath + '\\/src\\/.+\\.js');

	app.use(function(req, res) {
		if (plugins.hasListeners('action:meta.override404')) {
			return plugins.fireHook('action:meta.override404', {
				req: req,
				res: res,
				error: {}
			});
		}

		if (isClientScript.test(req.url)) {
			res.type('text/javascript').status(200).send('');
		} else if (isLanguage.test(req.url)) {
			res.status(200).json({});
		} else if (req.path.startsWith(relativePath + '/uploads') || (req.get('accept') && req.get('accept').indexOf('text/html') === -1) || req.path === '/favicon.ico') {
			res.sendStatus(404);
		} else if (req.accepts('html')) {
			if (process.env.NODE_ENV === 'development') {
				winston.warn('Route requested but not found: ' + req.url);
			}

			res.status(404);

			if (res.locals.isAPI) {
				return res.json({path: validator.escape(req.path.replace(/^\/api/, '') || ''), title: '[[global:404.title]]'});
			}

			middleware.buildHeader(req, res, function() {
				res.render('404', {path: validator.escape(req.path || ''), title: '[[global:404.title]]'});
			});
		} else {
			res.status(404).type('txt').send('Not found');
		}
	});
}

function handleErrors(app, middleware) {
	app.use(function(err, req, res, next) {
		switch (err.code) {
			case 'EBADCSRFTOKEN':
				winston.error(req.path + '\n', err.message);
				return res.sendStatus(403);
			case 'blacklisted-ip':
				return res.status(403).type('text/plain').send(err.message);
		}

		if (parseInt(err.status, 10) === 302 && err.path) {
			return res.locals.isAPI ? res.status(302).json(err.path) : res.redirect(err.path);
		}

		winston.error(req.path + '\n', err.stack);

		res.status(err.status || 500);

		if (res.locals.isAPI) {
			res.json({path: validator.escape(req.path || ''), error: err.message});
		} else {
			middleware.buildHeader(req, res, function() {
				res.render('500', {path: validator.escape(String(req.path || '')), error: validator.escape(err.message)});
			});
		}
	});
}

