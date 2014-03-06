"use strict";

var nconf = require('nconf'),
	controllers = require('./../controllers'),
	meta = require('./../meta'),
	plugins = require('./../plugins'),

	metaRoutes = require('./meta'),
	apiRoutes = require('./api'),
	adminRoutes = require('./admin'),
	feedRoutes = require('./feeds'),
	pluginRoutes = require('./plugins');


module.exports = function(app, middleware) {
	app.namespace(nconf.get('relative_path'), function() {
		adminRoutes(app, middleware, controllers);
		metaRoutes(app, middleware, controllers);
		apiRoutes(app, middleware, controllers);
		feedRoutes(app, middleware, controllers);
		
		/**
		* Every view has an associated API route.
		*
		*/
		/* Main */
		app.get('/', middleware.buildHeader, controllers.home);
		app.get('/api/home', controllers.home);

		app.get('/login', middleware.buildHeader, controllers.login);
		app.get('/api/login', controllers.login);

		app.get('/register', middleware.buildHeader, controllers.register);
		app.get('/api/register', controllers.register);

		app.get('/confirm/:code', middleware.buildHeader, controllers.confirmEmail);
		app.get('/api/confirm/:code', controllers.confirmEmail);

		app.get('/outgoing', middleware.buildHeader, controllers.outgoing);
		app.get('/api/outgoing', controllers.outgoing);

		app.get('/search/:term?', middleware.buildHeader, middleware.guestSearchingAllowed, controllers.search);
		app.get('/api/search/:term?', middleware.guestSearchingAllowed, controllers.search);

		app.get('/reset/:code?', middleware.buildHeader, controllers.reset);
		app.get('/api/reset/:code?', controllers.reset);

		/* Static Pages */
		app.get('/404', middleware.buildHeader, controllers.static['404']);
		app.get('/api/404', controllers.static['404']);

		app.get('/403', middleware.buildHeader, controllers.static['403']);
		app.get('/api/403', controllers.static['403']);

		app.get('/500', middleware.buildHeader, controllers.static['500']);
		app.get('/api/500', controllers.static['500']);

		/* Topics */
		app.get('/topic/:topic_id/:slug?', middleware.buildHeader, controllers.topics.get);
		app.get('/api/topic/:topic_id/:slug?', controllers.topics.get);

		/* Categories */
		app.get('/popular/:set?', middleware.buildHeader, controllers.categories.popular);
		app.get('/api/popular/:set?', controllers.categories.popular);

		app.get('/recent/:term?', middleware.buildHeader, controllers.categories.recent);
		app.get('/api/recent/:term?', controllers.categories.recent);

		app.get('/unread/', middleware.buildHeader, middleware.authenticate, controllers.categories.unread);
		app.get('/api/unread/', middleware.authenticate, controllers.categories.unread);

		app.get('/unread/total', middleware.buildHeader, middleware.authenticate, controllers.categories.unreadTotal);
		app.get('/api/unread/total', middleware.authenticate, controllers.categories.unreadTotal);

		app.get('/category/:category_id/:slug?', middleware.buildHeader, controllers.categories.get);
		app.get('/api/category/:category_id/:slug?', controllers.categories.get);

		/* Accounts */
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

		app.get('/user/:userslug/edit', middleware.buildHeader, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountEdit);
		app.get('/api/user/:userslug/edit', middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountEdit);

		// todo: admin recently gained access to this page, pls check if it actually works
		app.get('/user/:userslug/settings', middleware.buildHeader, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountSettings);
		app.get('/api/user/:userslug/settings', middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountSettings);

		app.get('/notifications', middleware.buildHeader, middleware.authenticate, controllers.accounts.getNotifications);
		app.get('/api/notifications', middleware.authenticate, controllers.accounts.getNotifications);

		/* Users */
		app.get('/users', middleware.buildHeader, middleware.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);
		app.get('/api/users', middleware.checkGlobalPrivacySettings, controllers.users.getOnlineUsers);

		// was this duped by accident or purpose?
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

		pluginRoutes(app, middleware, controllers);
		plugins.fireHook('action:app.load', app, middleware, controllers);

		if (process.env.NODE_ENV === 'development') {
			require('./debug')(app, middleware, controllers);
		}
	});
};