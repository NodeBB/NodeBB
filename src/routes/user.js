'use strict';

const helpers = require('./helpers');

const { setupPageRoute } = helpers;

module.exports = function (app, name, middleware, controllers) {
	const middlewares = [
		middleware.exposeUid,
		middleware.canViewUsers,
		middleware.buildAccountData,
	];
	const accountMiddlewares = [
		...middlewares,
		middleware.ensureLoggedIn,
		middleware.checkAccountPermissions,
	];

	setupPageRoute(app, '/me', [], middleware.redirectMeToUserslug);
	setupPageRoute(app, '/me/*', [], middleware.redirectMeToUserslug);
	setupPageRoute(app, '/uid/:uid*', [], middleware.redirectUidToUserslug);

	setupPageRoute(app, `/${name}/:userslug`, middlewares, controllers.accounts.profile.get);
	setupPageRoute(app, `/${name}/:userslug/following`, middlewares, controllers.accounts.follow.getFollowing);
	setupPageRoute(app, `/${name}/:userslug/followers`, middlewares, controllers.accounts.follow.getFollowers);

	setupPageRoute(app, `/${name}/:userslug/posts`, middlewares, controllers.accounts.posts.getPosts);
	setupPageRoute(app, `/${name}/:userslug/topics`, middlewares, controllers.accounts.posts.getTopics);
	setupPageRoute(app, `/${name}/:userslug/best`, middlewares, controllers.accounts.posts.getBestPosts);
	setupPageRoute(app, `/${name}/:userslug/controversial`, middlewares, controllers.accounts.posts.getControversialPosts);
	setupPageRoute(app, `/${name}/:userslug/groups`, middlewares, controllers.accounts.groups.get);

	setupPageRoute(app, `/${name}/:userslug/categories`, accountMiddlewares, controllers.accounts.categories.get);
	setupPageRoute(app, `/${name}/:userslug/tags`, accountMiddlewares, controllers.accounts.tags.get);
	setupPageRoute(app, `/${name}/:userslug/bookmarks`, accountMiddlewares, controllers.accounts.posts.getBookmarks);
	setupPageRoute(app, `/${name}/:userslug/watched`, accountMiddlewares, controllers.accounts.posts.getWatchedTopics);
	setupPageRoute(app, `/${name}/:userslug/ignored`, accountMiddlewares, controllers.accounts.posts.getIgnoredTopics);
	setupPageRoute(app, `/${name}/:userslug/upvoted`, accountMiddlewares, controllers.accounts.posts.getUpVotedPosts);
	setupPageRoute(app, `/${name}/:userslug/downvoted`, accountMiddlewares, controllers.accounts.posts.getDownVotedPosts);
	setupPageRoute(app, `/${name}/:userslug/edit`, accountMiddlewares, controllers.accounts.edit.get);
	setupPageRoute(app, `/${name}/:userslug/edit/username`, accountMiddlewares, controllers.accounts.edit.username);
	setupPageRoute(app, `/${name}/:userslug/edit/email`, accountMiddlewares, controllers.accounts.edit.email);
	setupPageRoute(app, `/${name}/:userslug/edit/password`, accountMiddlewares, controllers.accounts.edit.password);
	app.use('/.well-known/change-password', (req, res) => {
		res.redirect('/me/edit/password');
	});
	setupPageRoute(app, `/${name}/:userslug/info`, accountMiddlewares, controllers.accounts.info.get);
	setupPageRoute(app, `/${name}/:userslug/settings`, accountMiddlewares, controllers.accounts.settings.get);
	setupPageRoute(app, `/${name}/:userslug/uploads`, accountMiddlewares, controllers.accounts.uploads.get);
	setupPageRoute(app, `/${name}/:userslug/consent`, accountMiddlewares, controllers.accounts.consent.get);
	setupPageRoute(app, `/${name}/:userslug/blocks`, accountMiddlewares, controllers.accounts.blocks.getBlocks);
	setupPageRoute(app, `/${name}/:userslug/sessions`, accountMiddlewares, controllers.accounts.sessions.get);

	setupPageRoute(app, '/notifications', [middleware.ensureLoggedIn], controllers.accounts.notifications.get);
	setupPageRoute(app, `/${name}/:userslug/chats/:roomid?/:index?`, [middleware.exposeUid, middleware.canViewUsers], controllers.accounts.chats.get);
	setupPageRoute(app, '/chats/:roomid?/:index?', [middleware.ensureLoggedIn], controllers.accounts.chats.redirectToChat);

	setupPageRoute(app, `/message/:mid`, [middleware.ensureLoggedIn], controllers.accounts.chats.redirectToMessage);
};
