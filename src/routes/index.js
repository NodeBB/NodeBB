'use strict';

var nconf = require('nconf');
var winston = require('winston');
var path = require('path');
var async = require('async');
var express = require('express');

var meta = require('../meta');
var controllers = require('../controllers');
var plugins = require('../plugins');
var user = require('../user');

var accountRoutes = require('./accounts');
var metaRoutes = require('./meta');
var apiRoutes = require('./api');
var adminRoutes = require('./admin');
var feedRoutes = require('./feeds');
var authRoutes = require('./authentication');
var helpers = require('./helpers');

var setupPageRoute = helpers.setupPageRoute;

function mainRoutes(app, middleware, controllers) {
	var loginRegisterMiddleware = [middleware.redirectToAccountIfLoggedIn];

	setupPageRoute(app, '/login', middleware, loginRegisterMiddleware, controllers.login);
	setupPageRoute(app, '/register', middleware, loginRegisterMiddleware, controllers.register);
	setupPageRoute(app, '/register/complete', middleware, [], controllers.registerInterstitial);
	setupPageRoute(app, '/compose', middleware, [], controllers.composer.get);
	setupPageRoute(app, '/confirm/:code', middleware, [], controllers.confirmEmail);
	setupPageRoute(app, '/outgoing', middleware, [], controllers.outgoing);
	setupPageRoute(app, '/search', middleware, [], controllers.search.search);
	setupPageRoute(app, '/reset/:code?', middleware, [middleware.delayLoading], controllers.reset);
	setupPageRoute(app, '/tos', middleware, [], controllers.termsOfUse);

	app.post('/compose', middleware.applyCSRF, controllers.composer.post);
	app.post('/email/unsubscribe/:token', controllers.accounts.settings.unsubscribe);
}

function modRoutes(app, middleware, controllers) {
	setupPageRoute(app, '/flags', middleware, [], controllers.mods.flags.list);
	setupPageRoute(app, '/flags/:flagId', middleware, [], controllers.mods.flags.detail);
	setupPageRoute(app, '/post-queue', middleware, [], controllers.mods.postQueue);
}

function globalModRoutes(app, middleware, controllers) {
	setupPageRoute(app, '/ip-blacklist', middleware, [], controllers.globalMods.ipBlacklist);
	setupPageRoute(app, '/registration-queue', middleware, [], controllers.globalMods.registrationQueue);
}

function topicRoutes(app, middleware, controllers) {
	setupPageRoute(app, '/topic/:topic_id/:slug/:post_index?', middleware, [], controllers.topics.get);
	setupPageRoute(app, '/topic/:topic_id/:slug?', middleware, [], controllers.topics.get);
}

function postRoutes(app, middleware, controllers) {
	const middlewares = [middleware.maintenanceMode, middleware.registrationComplete, middleware.pluginHooks];
	app.get('/post/:pid', middleware.busyCheck, middleware.buildHeader, middlewares, controllers.posts.redirectToPost);
	app.get('/api/post/:pid', middlewares, controllers.posts.redirectToPost);
}

function tagRoutes(app, middleware, controllers) {
	setupPageRoute(app, '/tags/:tag', middleware, [middleware.privateTagListing], controllers.tags.getTag);
	setupPageRoute(app, '/tags', middleware, [middleware.privateTagListing], controllers.tags.getTags);
}

function categoryRoutes(app, middleware, controllers) {
	setupPageRoute(app, '/categories', middleware, [], controllers.categories.list);
	setupPageRoute(app, '/popular', middleware, [], controllers.popular.get);
	setupPageRoute(app, '/recent', middleware, [], controllers.recent.get);
	setupPageRoute(app, '/top', middleware, [], controllers.top.get);
	setupPageRoute(app, '/unread', middleware, [middleware.authenticate], controllers.unread.get);

	setupPageRoute(app, '/category/:category_id/:slug/:topic_index', middleware, [], controllers.category.get);
	setupPageRoute(app, '/category/:category_id/:slug?', middleware, [], controllers.category.get);
}

function userRoutes(app, middleware, controllers) {
	var middlewares = [middleware.canViewUsers];

	setupPageRoute(app, '/users', middleware, middlewares, controllers.users.index);
}

function groupRoutes(app, middleware, controllers) {
	var middlewares = [middleware.canViewGroups];

	setupPageRoute(app, '/groups', middleware, middlewares, controllers.groups.list);
	setupPageRoute(app, '/groups/:slug', middleware, middlewares, controllers.groups.details);
	setupPageRoute(app, '/groups/:slug/members', middleware, middlewares, controllers.groups.members);
}

module.exports = function (app, middleware, callback) {
	const router = express.Router();
	router.render = function () {
		app.render.apply(app, arguments);
	};
	var relativePath = nconf.get('relative_path');
	var ensureLoggedIn = require('connect-ensure-login');

	app.all(relativePath + '(/+api|/+api/*?)', middleware.prepareAPI);
	app.all(relativePath + '(/+api/admin|/+api/admin/*?)', middleware.isAdmin);
	app.all(relativePath + '(/+admin|/+admin/*?)', ensureLoggedIn.ensureLoggedIn(nconf.get('relative_path') + '/login?local=1'), middleware.applyCSRF, middleware.isAdmin);

	app.use(middleware.stripLeadingSlashes);

	// handle custom homepage routes
	router.use('/', controllers.home.rewrite);

	// homepage handled by `action:homepage.get:[route]`
	setupPageRoute(router, '/', middleware, [], controllers.home.pluginHook);

	async.series([
		async.apply(plugins.reloadRoutes, router),
		async.apply(authRoutes.reloadRoutes, router),
		async.apply(addCoreRoutes, app, router, middleware),
		async.apply(user.addInterstitials),
		function (next) {
			winston.info('Routes added');
			next();
		},
	], function (err) {
		callback(err);
	});
};

function addCoreRoutes(app, router, middleware, callback) {
	adminRoutes(router, middleware, controllers);
	metaRoutes(router, middleware, controllers);
	apiRoutes(router, middleware, controllers);
	feedRoutes(router, middleware, controllers);

	mainRoutes(router, middleware, controllers);
	topicRoutes(router, middleware, controllers);
	postRoutes(router, middleware, controllers);
	modRoutes(router, middleware, controllers);
	globalModRoutes(router, middleware, controllers);
	tagRoutes(router, middleware, controllers);
	categoryRoutes(router, middleware, controllers);
	accountRoutes(router, middleware, controllers);
	userRoutes(router, middleware, controllers);
	groupRoutes(router, middleware, controllers);

	var relativePath = nconf.get('relative_path');
	app.use(relativePath || '/', router);

	if (process.env.NODE_ENV === 'development') {
		require('./debug')(app, middleware, controllers);
	}

	app.use(middleware.privateUploads);

	var statics = [
		{ route: '/assets', path: path.join(__dirname, '../../build/public') },
		{ route: '/assets', path: path.join(__dirname, '../../public') },
		{ route: '/plugins', path: path.join(__dirname, '../../build/public/plugins') },
	];
	var staticOptions = {
		maxAge: app.enabled('cache') ? 5184000000 : 0,
	};

	if (path.resolve(__dirname, '../../public/uploads') !== nconf.get('upload_path')) {
		statics.unshift({ route: '/assets/uploads', path: nconf.get('upload_path') });
	}

	statics.forEach(function (obj) {
		app.use(relativePath + obj.route, middleware.trimUploadTimestamps, express.static(obj.path, staticOptions));
	});
	app.use(relativePath + '/uploads', function (req, res) {
		res.redirect(relativePath + '/assets/uploads' + req.path + '?' + meta.config['cache-buster']);
	});

	// Skins
	meta.css.supportedSkins.forEach(function (skin) {
		app.use(relativePath + '/assets/client-' + skin + '.css', middleware.buildSkinAsset);
	});

	// only warn once
	var warned = new Set();

	// DEPRECATED (v1.12.0)
	app.use(relativePath + '/assets/stylesheet.css', function (req, res) {
		if (!warned.has(req.path)) {
			winston.warn('[deprecated] Accessing `/assets/stylesheet.css` is deprecated to be REMOVED in NodeBB v1.12.0. ' +
			'Use `/assets/client.css` to access this file');
			warned.add(req.path);
		}
		res.redirect(relativePath + '/assets/client.css?' + meta.config['cache-buster']);
	});

	app.use(controllers['404'].handle404);
	app.use(controllers.errors.handleURIErrors);
	app.use(controllers.errors.handleErrors);
	setImmediate(callback);
}
