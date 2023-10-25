'use strict';

const accountsController = {
	profile: require('./accounts/profile'),
	edit: require('./accounts/edit'),
	info: require('./accounts/info'),
	categories: require('./accounts/categories'),
	tags: require('./accounts/tags'),
	settings: require('./accounts/settings'),
	groups: require('./accounts/groups'),
	follow: require('./accounts/follow'),
	posts: require('./accounts/posts'),
	notifications: require('./accounts/notifications'),
	chats: require('./accounts/chats'),
	sessions: require('./accounts/sessions'),
	blocks: require('./accounts/blocks'),
	uploads: require('./accounts/uploads'),
	consent: require('./accounts/consent'),
};

module.exports = accountsController;
