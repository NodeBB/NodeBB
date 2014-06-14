"use strict";

var nconf = require('nconf'),
	controllers = require('./../controllers'),
	meta = require('./../meta'),
	plugins = require('./../plugins'),

	metaRoutes = require('./meta'),
	apiRoutes = require('./api'),
	adminRoutes = require('./admin'),
	feedRoutes = require('./feeds'),
	pluginRoutes = require('./plugins'),
	authRoutes = require('./authentication');



function mainRoutes(app, middleware, controllers) {
	app.get('/', middleware.buildHeader, controllers.home);
	app.get('/api/home', controllers.home);

	app.get('/login', middleware.redirectToAccountIfLoggedIn, middleware.buildHeader, controllers.login);
	app.get('/api/login', middleware.redirectToAccountIfLoggedIn, controllers.login);

	app.get('/register', middleware.redirectToAccountIfLoggedIn, middleware.buildHeader, controllers.register);
	app.get('/api/register', middleware.redirectToAccountIfLoggedIn, controllers.register);

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

	app.get('/topic/:topic_id/:slug/:post_index?', middleware.buildHeader, middleware.checkPostIndex, controllers.topics.get);
	app.get('/api/topic/:topic_id/:slug/:post_index?', middleware.checkPostIndex, controllers.topics.get);

	app.get('/topic/:topic_id/:slug?', middleware.buildHeader, middleware.addSlug, controllers.topics.get);
	app.get('/api/topic/:topic_id/:slug?', middleware.addSlug, controllers.topics.get);
}

function tagRoutes(app, middleware, controllers) {

	app.get('/tags/:tag', middleware.buildHeader, controllers.tags.getTag);
	app.get('/api/tags/:tag', controllers.tags.getTag);

	app.get('/tags', middleware.buildHeader, controllers.tags.getTags);
	app.get('/api/tags', controllers.tags.getTags);
}

function categoryRoutes(app, middleware, controllers) {
	app.get('/popular/:set?', middleware.buildHeader, controllers.categories.popular);
	app.get('/api/popular/:set?', controllers.categories.popular);

	app.get('/recent/:term?', middleware.buildHeader, controllers.categories.recent);
	app.get('/api/recent/:term?', controllers.categories.recent);

	app.get('/unread/', middleware.buildHeader, middleware.authenticate, controllers.categories.unread);
	app.get('/api/unread/', middleware.authenticate, controllers.categories.unread);

	app.get('/unread/total', middleware.buildHeader, middleware.authenticate, controllers.categories.unreadTotal);
	app.get('/api/unread/total', middleware.authenticate, controllers.categories.unreadTotal);

	app.get('/category/:category_id/:slug?', middleware.buildHeader, middleware.addSlug, controllers.categories.get);
	app.get('/api/category/:category_id/:slug?', controllers.categories.get);
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

	app.get('/user/:userslug/edit', middleware.buildHeader, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountEdit);
	app.get('/api/user/:userslug/edit', middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountEdit);

	// todo: admin recently gained access to this page, pls check if it actually works
	app.get('/user/:userslug/settings', middleware.buildHeader, middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountSettings);
	app.get('/api/user/:userslug/settings', middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions, controllers.accounts.accountSettings);

	app.get('/notifications', middleware.buildHeader, middleware.authenticate, controllers.accounts.getNotifications);
	app.get('/api/notifications', middleware.authenticate, controllers.accounts.getNotifications);

	app.get('/chats', middleware.buildHeader, middleware.authenticate, controllers.accounts.getChats);
	app.get('/api/chats', middleware.authenticate, controllers.accounts.getChats);
}

function userRoutes(app, middleware, controllers) {
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
}

function groupRoutes(app, middleware, controllers) {
	app.get('/groups', middleware.buildHeader, controllers.groups.list);
	app.get('/api/groups', controllers.groups.list);

	app.get('/groups/:name', middleware.buildHeader, controllers.groups.details);
	app.get('/api/groups/:name', controllers.groups.details);
}


module.exports = function(app, middleware) {
	app.namespace(nconf.get('relative_path'), function() {
		plugins.ready(function() {
			app.all('/api/*', middleware.updateLastOnlineTime, middleware.prepareAPI);
			app.all('/api/admin/*', middleware.admin.isAdmin, middleware.prepareAPI);
			app.all('/admin/*', middleware.admin.isAdmin);
			app.get('/admin', middleware.admin.isAdmin);

			plugins.fireHook('action:app.load', app, middleware, controllers);

			adminRoutes(app, middleware, controllers);
			metaRoutes(app, middleware, controllers);
			apiRoutes(app, middleware, controllers);
			feedRoutes(app, middleware, controllers);
			pluginRoutes(app, middleware, controllers);
			authRoutes.createRoutes(app, middleware, controllers);

			/**
			* Every view has an associated API route.
			*
			*/
			mainRoutes(app, middleware, controllers);
			staticRoutes(app, middleware, controllers);
			topicRoutes(app, middleware, controllers);
			tagRoutes(app, middleware, controllers);
			categoryRoutes(app, middleware, controllers);
			accountRoutes(app, middleware, controllers);
			userRoutes(app, middleware, controllers);
			groupRoutes(app, middleware, controllers);
		});

		if (process.env.NODE_ENV === 'development') {
			require('./debug')(app, middleware, controllers);
		}
	});
};
