"use strict";

var helpers = require('./helpers');
var setupPageRoute = helpers.setupPageRoute;

module.exports = function (app, middleware, controllers) {
	var middlewares = [middleware.checkGlobalPrivacySettings];
	var accountMiddlewares = [middleware.checkGlobalPrivacySettings, middleware.checkAccountPermissions];

	setupPageRoute(app, '/user/:userslug', middleware, middlewares, controllers.accounts.profile.get);
	setupPageRoute(app, '/user/:userslug/following', middleware, middlewares, controllers.accounts.follow.getFollowing);
	setupPageRoute(app, '/user/:userslug/followers', middleware, middlewares, controllers.accounts.follow.getFollowers);
	setupPageRoute(app, '/user/:userslug/posts', middleware, middlewares, controllers.accounts.posts.getPosts);
	setupPageRoute(app, '/user/:userslug/topics', middleware, middlewares, controllers.accounts.posts.getTopics);
	setupPageRoute(app, '/user/:userslug/best', middleware, middlewares, controllers.accounts.posts.getBestPosts);
	setupPageRoute(app, '/user/:userslug/groups', middleware, middlewares, controllers.accounts.groups.get);

	setupPageRoute(app, '/user/:userslug/favourites', middleware, accountMiddlewares, controllers.accounts.posts.getFavourites);
	setupPageRoute(app, '/user/:userslug/watched', middleware, accountMiddlewares, controllers.accounts.posts.getWatchedTopics);
	setupPageRoute(app, '/user/:userslug/upvoted', middleware, accountMiddlewares, controllers.accounts.posts.getUpVotedPosts);
	setupPageRoute(app, '/user/:userslug/downvoted', middleware, accountMiddlewares, controllers.accounts.posts.getDownVotedPosts);
	setupPageRoute(app, '/user/:userslug/edit', middleware, accountMiddlewares, controllers.accounts.edit.get);
	setupPageRoute(app, '/user/:userslug/edit/username', middleware, accountMiddlewares, controllers.accounts.edit.username);
	setupPageRoute(app, '/user/:userslug/edit/email', middleware, accountMiddlewares, controllers.accounts.edit.email);
	setupPageRoute(app, '/user/:userslug/edit/password', middleware, accountMiddlewares, controllers.accounts.edit.password);
	setupPageRoute(app, '/user/:userslug/settings', middleware, accountMiddlewares, controllers.accounts.settings.get);

	app.delete('/user/:userslug/session/:uuid', accountMiddlewares, controllers.accounts.session.revoke);

	setupPageRoute(app, '/notifications', middleware, [middleware.authenticate], controllers.accounts.notifications.get);
	setupPageRoute(app, '/chats/:roomid?', middleware, [middleware.authenticate], controllers.accounts.chats.get);
};
