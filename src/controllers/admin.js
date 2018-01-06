'use strict';

var adminController = {
	dashboard: require('./admin/dashboard'),
	categories: require('./admin/categories'),
	privileges: require('./admin/privileges'),
	adminsMods: require('./admin/admins-mods'),
	tags: require('./admin/tags'),
	postQueue: require('./admin/postqueue'),
	blacklist: require('./admin/blacklist'),
	groups: require('./admin/groups'),
	appearance: require('./admin/appearance'),
	extend: {
		widgets: require('./admin/widgets'),
		rewards: require('./admin/rewards'),
	},
	events: require('./admin/events'),
	logs: require('./admin/logs'),
	errors: require('./admin/errors'),
	database: require('./admin/database'),
	cache: require('./admin/cache'),
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
	info: require('./admin/info'),
};


module.exports = adminController;
