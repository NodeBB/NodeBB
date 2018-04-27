'use strict';

var accountsController = {
	profile: require('./accounts/profile'),
	edit: require('./accounts/edit'),
	info: require('./accounts/info'),
	settings: require('./accounts/settings'),
	groups: require('./accounts/groups'),
	follow: require('./accounts/follow'),
	posts: require('./accounts/posts'),
	notifications: require('./accounts/notifications'),
	chats: require('./accounts/chats'),
	session: require('./accounts/session'),
	blocks: require('./accounts/blocks'),
	uploads: require('./accounts/uploads'),
	consent: require('./accounts/consent'),
};

module.exports = accountsController;
