"use strict";

var nconf = require('nconf'),
	path = require('path'),
	winston = require('winston'),
	controllers = require('./../controllers'),
	meta = require('./../meta'),
	plugins = require('./../plugins'),
	express = require('express'),

	metaRoutes = require('./meta'),
	apiRoutes = require('./api'),
	adminRoutes = require('./admin'),
	feedRoutes = require('./feeds'),
	pluginRoutes = require('./plugins'),
	authRoutes = require('./authentication');



function mainRoutes(app, middleware, controllers) {
	setupPageRoute(app, '/', middleware, [], controllers.home);

	var loginRegisterMiddleware = [middleware.applyCSRF, middleware.redirectToAccountIfLoggedIn];

	setupPageRoute(app, '/login', middleware, loginRegisterMiddleware, controllers.login);
	setupPageRoute(app, '/register', middleware, loginRegisterMiddleware, controllers.register);
	setupPageRoute(app, '/confirm/:code', middleware, [], controllers.confirmEmail);
	setupPageRoute(app, '/outgoing', middleware, [], controllers.outgoing);
	setupPageRoute(app, '/search/:term?', middleware, [middleware.guestSearchingAllowed], controllers.search);
	setupPageRoute(app, '/reset/:code?', middleware, [], controllers.reset);
}

function staticRoutes(app, middleware, controllers) {
	setupPageRoute(app, '/404', middleware, [], controllers.static['404']);
	setupPageRoute(app, '/403', middleware, [], controllers.static['403']);
	setupPageRoute(app, '/500', middleware, [], controllers.static['500']);
}

function topicRoutes(app, middleware, controllers) {
	app.get('/api/topic/teaser/:topic_id', controllers.topics.teaser);

	setupPageRoute(app, '/topic/:topic_id/:slug/:post_index?', middleware, [middleware.applyCSRF], controllers.topics.get);
	setupPageRoute(app, '/topic/:topic_id/:slug?', middleware, [middleware.applyCSRF, middleware.addSlug], controllers.topics.get);
}

function tagRoutes(app, middleware, controllers) {
	setupPageRoute(app, '/tags/:tag', middleware, [], controllers.tags.getTag);
	setupPageRoute(app, '/tags', middleware, [], controllers.tags.getTags);
}

function categoryRoutes(app, middleware, controllers) {
	setupPageRoute(app, '/popular/:term?', middleware, [], controllers.categories.popular);
	setupPageRoute(app, '/recent/:term?', middleware, [], controllers.categories.recent);
	setupPageRoute(app, '/unread', middleware, [middleware.authenticate], controllers.categories.unread);
	app.get('/api/unread/total', middleware.authenticate, controllers.categories.unreadTotal);

	setupPageRoute(app, '/category/:category_id/:slug/:topic_index', middleware, [middleware.applyCSRF, middleware.checkTopicIndex], controllers.categories.get);
	setupPageRoute(app, '/category/:category_id/:slug?', middleware, [middleware.applyCSRF, middleware.addSlug], controllers.categories.get);
}

function accountRoutes(app, middleware, controllers) {
	var middlewares = [middleware.checkGlobalPrivacySettings];
	var accountMiddlewares = [middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions];

	setupPageRoute(app, '/user/:userslug', middleware, middlewares, controllers.accounts.getAccount);
	setupPageRoute(app, '/user/:userslug/following', middleware, middlewares, controllers.accounts.getFollowing);
	setupPageRoute(app, '/user/:userslug/followers', middleware, middlewares, controllers.accounts.getFollowers);
	setupPageRoute(app, '/user/:userslug/posts', middleware, middlewares, controllers.accounts.getPosts);
	setupPageRoute(app, '/user/:userslug/topics', middleware, middlewares, controllers.accounts.getTopics);

	setupPageRoute(app, '/user/:userslug/favourites', middleware, accountMiddlewares, controllers.accounts.getFavourites);
	setupPageRoute(app, '/user/:userslug/edit', middleware, [middleware.applyCSRF].concat(accountMiddlewares), controllers.accounts.accountEdit);
	setupPageRoute(app, '/user/:userslug/settings', middleware, accountMiddlewares, controllers.accounts.accountSettings);

	setupPageRoute(app, '/notifications', middleware, [middleware.authenticate], controllers.accounts.getNotifications);
	setupPageRoute(app, '/chats/:userslug?', middleware, [middleware.redirectToLoginIfGuest], controllers.accounts.getChats);
}

function userRoutes(app, middleware, controllers) {
	var middlewares = [middleware.checkGlobalPrivacySettings];

	setupPageRoute(app, '/users', middleware, middlewares, controllers.users.getOnlineUsers);
	setupPageRoute(app, '/users/online', middleware, middlewares, controllers.users.getOnlineUsers);
	setupPageRoute(app, '/users/sort-posts', middleware, middlewares, controllers.users.getUsersSortedByPosts);
	setupPageRoute(app, '/users/sort-reputation', middleware, middlewares, controllers.users.getUsersSortedByReputation);
	setupPageRoute(app, '/users/latest', middleware, middlewares, controllers.users.getUsersSortedByJoinDate);
	setupPageRoute(app, '/users/search', middleware, middlewares, controllers.users.getUsersForSearch);
 }

function groupRoutes(app, middleware, controllers) {
	var middlewares = [middleware.checkGlobalPrivacySettings];

	setupPageRoute(app, '/groups', middleware, middlewares, controllers.groups.list);
	setupPageRoute(app, '/groups/:name', middleware, middlewares, controllers.groups.details);
}

function setupPageRoute(router, name, middleware, middlewares, controller) {
	middlewares = middlewares.concat([middleware.incrementPageViews, middleware.updateLastOnlineTime]);

	router.get(name, middleware.buildHeader, middlewares, controller);
	router.get('/api' + name, middlewares, controller);
}

module.exports = function(app, middleware) {
	var router = express.Router(),
		pluginRouter = express.Router(),
		authRouter = express.Router(),
		relativePath = nconf.get('relative_path');

	pluginRouter.render = function() {
		app.render.apply(app, arguments);
	};

	// Set-up for hotswapping (when NodeBB reloads)
	pluginRouter.hotswapId = 'plugins';
	authRouter.hotswapId = 'auth';

	app.use(middleware.maintenanceMode);

	app.all(relativePath + '/api/?*', middleware.prepareAPI);
	app.all(relativePath + '/api/admin/*', middleware.admin.isAdmin, middleware.prepareAPI);
	app.all(relativePath + '/admin/?*', middleware.ensureLoggedIn, middleware.admin.isAdmin);

	adminRoutes(router, middleware, controllers);
	metaRoutes(router, middleware, controllers);
	apiRoutes(router, middleware, controllers);
	feedRoutes(router, middleware, controllers);
	pluginRoutes(router, middleware, controllers);

	/**
	* Every view has an associated API route.
	*
	*/

	mainRoutes(router, middleware, controllers);
	staticRoutes(router, middleware, controllers);
	topicRoutes(router, middleware, controllers);
	tagRoutes(router, middleware, controllers);
	categoryRoutes(router, middleware, controllers);
	accountRoutes(router, middleware, controllers);
	userRoutes(router, middleware, controllers);
	groupRoutes(router, middleware, controllers);

	app.use(relativePath, router);
	app.use(relativePath, pluginRouter);
	app.use(relativePath, authRouter);

	if (process.env.NODE_ENV === 'development') {
		require('./debug')(app, middleware, controllers);
	}

	app.use(relativePath, express.static(path.join(__dirname, '../../', 'public'), {
		maxAge: app.enabled('cache') ? 5184000000 : 0
	}));

	app.use(catch404);
	app.use(handleErrors);

	// Add plugin routes
	plugins.init(app, middleware);
	authRoutes.reloadRoutes();
};

function handleErrors(err, req, res, next) {
	// we may use properties of the error object
	// here and next(err) appropriately, or if
	// we possibly recovered from the error, simply next().
	console.error(err.stack);

	var status = err.status || 500;
	res.status(status);

	req.flash('errorMessage', err.message);

	res.redirect(nconf.get('relative_path') + '/500')
}

function catch404(req, res, next) {
	var relativePath = nconf.get('relative_path');
	var	isLanguage = new RegExp('^' + relativePath + '/language/[\\w]{2,}/.*.json'),
		isClientScript = new RegExp('^' + relativePath + '\\/src\\/forum(\\/admin)?\\/.+\\.js');

	res.status(404);

	if (isClientScript.test(req.url)) {
		res.type('text/javascript').send(200, '');
	} else if (isLanguage.test(req.url)) {
		res.json(200, {});
	} else if (req.accepts('html')) {
		if (process.env.NODE_ENV === 'development') {
			winston.warn('Route requested but not found: ' + req.url);
		}

		res.redirect(relativePath + '/404');
	} else if (req.accepts('json')) {
		if (process.env.NODE_ENV === 'development') {
			winston.warn('Route requested but not found: ' + req.url);
		}

		res.json({
			error: 'Not found'
		});
	} else {
		res.type('txt').send('Not found');
	}
}
