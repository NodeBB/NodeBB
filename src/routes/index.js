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
	app.get('/', middleware.buildHeader, controllers.home);
	app.get('/api', controllers.home);

	app.get('/login', middleware.applyCSRF, middleware.redirectToAccountIfLoggedIn, middleware.buildHeader, controllers.login);
	app.get('/api/login', middleware.applyCSRF, middleware.redirectToAccountIfLoggedIn, controllers.login);

	app.get('/register', middleware.applyCSRF, middleware.redirectToAccountIfLoggedIn, middleware.buildHeader, controllers.register);
	app.get('/api/register', middleware.applyCSRF, middleware.redirectToAccountIfLoggedIn, controllers.register);

	app.get('/confirm/:code', middleware.buildHeader, controllers.confirmEmail);
	app.get('/api/confirm/:code', controllers.confirmEmail);

	app.get('/outgoing', middleware.buildHeader, controllers.outgoing);
	app.get('/api/outgoing', controllers.outgoing);

	app.get('/search/:term?', middleware.buildHeader, middleware.guestSearchingAllowed, controllers.search);
	app.get('/api/search/:term?', middleware.guestSearchingAllowed, controllers.search);

	app.get('/reset/:code?', middleware.buildHeader, controllers.reset);
	app.get('/api/reset/:code?', controllers.reset);
}

function staticRoutes(app, middleware, controllers) {
	app.get('/404', middleware.buildHeader, controllers.static['404']);
	app.get('/api/404', controllers.static['404']);

	app.get('/403', middleware.buildHeader, controllers.static['403']);
	app.get('/api/403', controllers.static['403']);

	app.get('/500', middleware.buildHeader, controllers.static['500']);
	app.get('/api/500', controllers.static['500']);
}

function topicRoutes(app, middleware, controllers) {
	app.get('/api/topic/teaser/:topic_id', controllers.topics.teaser);

	app.get('/topic/:topic_id/:slug/:post_index?', middleware.applyCSRF, middleware.buildHeader, controllers.topics.get);
	app.get('/api/topic/:topic_id/:slug/:post_index?', middleware.applyCSRF, controllers.topics.get);

	app.get('/topic/:topic_id/:slug?', middleware.applyCSRF, middleware.buildHeader, middleware.addSlug, controllers.topics.get);
	app.get('/api/topic/:topic_id/:slug?', middleware.applyCSRF, middleware.addSlug, controllers.topics.get);
}

function tagRoutes(app, middleware, controllers) {

	app.get('/tags/:tag', middleware.buildHeader, controllers.tags.getTag);
	app.get('/api/tags/:tag', controllers.tags.getTag);

	app.get('/tags', middleware.buildHeader, controllers.tags.getTags);
	app.get('/api/tags', controllers.tags.getTags);
}

function categoryRoutes(app, middleware, controllers) {
	app.get('/popular/:term?', middleware.buildHeader, controllers.categories.popular);
	app.get('/api/popular/:term?', controllers.categories.popular);

	app.get('/recent/:term?', middleware.buildHeader, controllers.categories.recent);
	app.get('/api/recent/:term?', controllers.categories.recent);

	app.get('/unread', middleware.buildHeader, middleware.authenticate, controllers.categories.unread);
	app.get('/api/unread', middleware.authenticate, controllers.categories.unread);

	app.get('/api/unread/total', middleware.authenticate, controllers.categories.unreadTotal);

	app.get('/category/:category_id/:slug/:topic_index', middleware.applyCSRF, middleware.buildHeader, middleware.checkTopicIndex, controllers.categories.get);
	app.get('/api/category/:category_id/:slug/:topic_index', middleware.applyCSRF, middleware.checkTopicIndex, controllers.categories.get);

	app.get('/category/:category_id/:slug?', middleware.applyCSRF, middleware.buildHeader, middleware.addSlug, controllers.categories.get);
	app.get('/api/category/:category_id/:slug?', middleware.applyCSRF, controllers.categories.get);
}

function accountRoutes(app, middleware, controllers) {
	app.get('/user/:userslug', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.accounts.getAccount);
	app.get('/api/user/:userslug', middleware.checkGlobalPrivacySettings, controllers.accounts.getAccount);

	app.get('/user/:userslug/following', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.accounts.getFollowing);
	app.get('/api/user/:userslug/following', middleware.checkGlobalPrivacySettings, controllers.accounts.getFollowing);

	app.get('/user/:userslug/followers', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.accounts.getFollowers);
	app.get('/api/user/:userslug/followers', middleware.checkGlobalPrivacySettings, controllers.accounts.getFollowers);

	app.get('/user/:userslug/favourites', middleware.buildHeader, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.getFavourites);
	app.get('/api/user/:userslug/favourites', middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.getFavourites);

	app.get('/user/:userslug/posts', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.accounts.getPosts);
	app.get('/api/user/:userslug/posts', middleware.checkGlobalPrivacySettings, controllers.accounts.getPosts);

	app.get('/user/:userslug/topics', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.accounts.getTopics);
	app.get('/api/user/:userslug/topics', middleware.checkGlobalPrivacySettings, controllers.accounts.getTopics);

	app.get('/user/:userslug/edit', middleware.applyCSRF, middleware.buildHeader, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountEdit);
	app.get('/api/user/:userslug/edit', middleware.applyCSRF, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountEdit);

	app.get('/user/:userslug/settings', middleware.buildHeader, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountSettings);
	app.get('/api/user/:userslug/settings', middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountSettings);

	app.get('/notifications', middleware.buildHeader, middleware.authenticate, controllers.accounts.getNotifications);
	app.get('/api/notifications', middleware.authenticate, controllers.accounts.getNotifications);

	app.get('/chats/:userslug?', middleware.buildHeader, middleware.redirectToLoginIfGuest, controllers.accounts.getChats);
	app.get('/api/chats/:userslug?', middleware.redirectToLoginIfGuest, controllers.accounts.getChats);
}

function userRoutes(app, middleware, controllers) {
	app.get('/user(s)?', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);
	app.get('/api/users', middleware.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);

	app.get('/users/online', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);
	app.get('/api/users/online', middleware.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);

	app.get('/users/sort-posts', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByPosts);
	app.get('/api/users/sort-posts', middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByPosts);

	app.get('/users/sort-reputation', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByReputation);
	app.get('/api/users/sort-reputation', middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByReputation);

	app.get('/users/latest', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByJoinDate);
	app.get('/api/users/latest', middleware.checkGlobalPrivacySettings, controllers.users.getUsersSortedByJoinDate);

	app.get('/users/search', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getUsersForSearch);
	app.get('/api/users/search', middleware.checkGlobalPrivacySettings, controllers.users.getUsersForSearch);
}

function groupRoutes(app, middleware, controllers) {
	app.get('/groups', middleware.buildHeader, controllers.groups.list);
	app.get('/api/groups', controllers.groups.list);

	app.get('/groups/:name', middleware.buildHeader, controllers.groups.details);
	app.get('/api/groups/:name', controllers.groups.details);
}


module.exports = function(app, middleware) {
	var router = express.Router(),
		pageRouter = express.Router(),
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

	app.use(relativePath, express.static(path.join(__dirname, '../../', 'public'), {
		maxAge: app.enabled('cache') ? 5184000000 : 0
	}));

	/**
	* Every view has an associated API route.
	*
	*/
	pageRouter.use(middleware.incrementPageViews);
	pageRouter.use(middleware.updateLastOnlineTime);

	mainRoutes(pageRouter, middleware, controllers);
	staticRoutes(pageRouter, middleware, controllers);
	topicRoutes(pageRouter, middleware, controllers);
	tagRoutes(pageRouter, middleware, controllers);
	categoryRoutes(pageRouter, middleware, controllers);
	accountRoutes(pageRouter, middleware, controllers);
	userRoutes(pageRouter, middleware, controllers);
	groupRoutes(pageRouter, middleware, controllers);

	app.use(relativePath, router);
	app.use(relativePath, pluginRouter);
	app.use(relativePath, pageRouter);
	app.use(relativePath, authRouter);

	if (process.env.NODE_ENV === 'development') {
		require('./debug')(app, middleware, controllers);
	}
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
