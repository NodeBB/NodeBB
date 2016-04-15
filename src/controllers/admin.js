"use strict";

var adminController = {
	dashboard: require('./admin/dashboard'),
	categories: require('./admin/categories'),
	tags: require('./admin/tags'),
	flags: require('./admin/flags'),
	blacklist: require('./admin/blacklist'),
	groups: require('./admin/groups'),
	appearance: require('./admin/appearance'),
	extend: {
		widgets: require('./admin/widgets'),
		rewards: require('./admin/rewards')
	},
	events: require('./admin/events'),
	logs: require('./admin/logs'),
	database: require('./admin/database'),
	postCache: require('./admin/postCache'),
	plugins: require('./admin/plugins'),
	languages: require('./admin/languages'),
	settings: require('./admin/settings'),
	logger: require('./admin/logger'),
	sounds: require('./admin/sounds'),
	homepage: require('./admin/homepage'),
	navigation: require('./admin/navigation'),
	social: require('./admin/social'),
	themes: require('./admin/themes'),
	users: require('./admin/users'),
	uploads: require('./admin/uploads'),
	info: require('./admin/info')
};


module.exports = adminController;
