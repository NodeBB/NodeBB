"use strict";

var helpers = require('./helpers');
var setupPageRoute = helpers.setupPageRoute;

module.exports = function (app, middleware, controllers) {
	var middlewares = [middleware.checkGlobalPrivacySettings];
	var accountMiddlewares = [middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions];

	setupPageRoute(app, '/user/:userslug', middleware, middlewares, controllers.accounts.profile.get);
	setupPageRoute(app, '/user/:userslug/following', middleware, middlewares, controllers.accounts.getFollowing);
	setupPageRoute(app, '/user/:userslug/followers', middleware, middlewares, controllers.accounts.getFollowers);
	setupPageRoute(app, '/user/:userslug/posts', middleware, middlewares, controllers.accounts.getPosts);
	setupPageRoute(app, '/user/:userslug/topics', middleware, middlewares, controllers.accounts.getTopics);
	setupPageRoute(app, '/user/:userslug/groups', middleware, middlewares, controllers.accounts.getGroups);

	setupPageRoute(app, '/user/:userslug/favourites', middleware, accountMiddlewares, controllers.accounts.getFavourites);
	setupPageRoute(app, '/user/:userslug/watched', middleware, accountMiddlewares, controllers.accounts.getWatchedTopics);
	setupPageRoute(app, '/user/:userslug/edit', middleware, accountMiddlewares, controllers.accounts.edit.get);
	setupPageRoute(app, '/user/:userslug/settings', middleware, accountMiddlewares, controllers.accounts.accountSettings);

	setupPageRoute(app, '/notifications', middleware, [middleware.authenticate], controllers.accounts.getNotifications);
	setupPageRoute(app, '/chats/:userslug?', middleware, [middleware.redirectToLoginIfGuest], controllers.accounts.getChats);
};
