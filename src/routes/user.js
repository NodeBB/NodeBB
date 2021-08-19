'use strict';

const helpers = require('./helpers');

const { setupPageRoute } = helpers;

module.exports = function (app, name, middleware, controllers) {
	const middlewares = [middleware.exposeUid, middleware.canViewUsers];
	const accountMiddlewares = [
		middleware.exposeUid,
		middleware.ensureLoggedIn,
		middleware.canViewUsers,
		middleware.checkAccountPermissions,
	];

	setupPageRoute(app, '/me', middleware, [], middleware.redirectMeToUserslug);
	setupPageRoute(app, '/me/*', middleware, [], middleware.redirectMeToUserslug);
	setupPageRoute(app, '/uid/:uid*', middleware, [], middleware.redirectUidToUserslug);

	setupPageRoute(app, `/${name}/:userslug`, middleware, middlewares, controllers.accounts.profile.get);
	setupPageRoute(app, `/${name}/:userslug/following`, middleware, middlewares, controllers.accounts.follow.getFollowing);
	setupPageRoute(app, `/${name}/:userslug/followers`, middleware, middlewares, controllers.accounts.follow.getFollowers);

	setupPageRoute(app, `/${name}/:userslug/posts`, middleware, middlewares, controllers.accounts.posts.getPosts);
	setupPageRoute(app, `/${name}/:userslug/topics`, middleware, middlewares, controllers.accounts.posts.getTopics);
	setupPageRoute(app, `/${name}/:userslug/best`, middleware, middlewares, controllers.accounts.posts.getBestPosts);
	setupPageRoute(app, `/${name}/:userslug/groups`, middleware, middlewares, controllers.accounts.groups.get);

	setupPageRoute(app, `/${name}/:userslug/categories`, middleware, accountMiddlewares, controllers.accounts.categories.get);
	setupPageRoute(app, `/${name}/:userslug/bookmarks`, middleware, accountMiddlewares, controllers.accounts.posts.getBookmarks);
	setupPageRoute(app, `/${name}/:userslug/watched`, middleware, accountMiddlewares, controllers.accounts.posts.getWatchedTopics);
	setupPageRoute(app, `/${name}/:userslug/ignored`, middleware, accountMiddlewares, controllers.accounts.posts.getIgnoredTopics);
	setupPageRoute(app, `/${name}/:userslug/upvoted`, middleware, accountMiddlewares, controllers.accounts.posts.getUpVotedPosts);
	setupPageRoute(app, `/${name}/:userslug/downvoted`, middleware, accountMiddlewares, controllers.accounts.posts.getDownVotedPosts);
	setupPageRoute(app, `/${name}/:userslug/edit`, middleware, accountMiddlewares, controllers.accounts.edit.get);
	setupPageRoute(app, `/${name}/:userslug/edit/username`, middleware, accountMiddlewares, controllers.accounts.edit.username);
	setupPageRoute(app, `/${name}/:userslug/edit/email`, middleware, accountMiddlewares, controllers.accounts.edit.email);
	setupPageRoute(app, `/${name}/:userslug/edit/password`, middleware, accountMiddlewares, controllers.accounts.edit.password);
	app.use('/.well-known/change-password', (req, res) => {
		res.redirect('/me/edit/password');
	});
	setupPageRoute(app, `/${name}/:userslug/info`, middleware, accountMiddlewares, controllers.accounts.info.get);
	setupPageRoute(app, `/${name}/:userslug/settings`, middleware, accountMiddlewares, controllers.accounts.settings.get);
	setupPageRoute(app, `/${name}/:userslug/uploads`, middleware, accountMiddlewares, controllers.accounts.uploads.get);
	setupPageRoute(app, `/${name}/:userslug/consent`, middleware, accountMiddlewares, controllers.accounts.consent.get);
	setupPageRoute(app, `/${name}/:userslug/blocks`, middleware, accountMiddlewares, controllers.accounts.blocks.getBlocks);
	setupPageRoute(app, `/${name}/:userslug/sessions`, middleware, accountMiddlewares, controllers.accounts.sessions.get);

	setupPageRoute(app, '/notifications', middleware, [middleware.ensureLoggedIn], controllers.accounts.notifications.get);
	setupPageRoute(app, `/${name}/:userslug/chats/:roomid?`, middleware, middlewares, controllers.accounts.chats.get);
	setupPageRoute(app, '/chats/:roomid?', middleware, [middleware.ensureLoggedIn], controllers.accounts.chats.redirectToChat);
};
