'use strict';

var adminController = {
	dashboard: require('./admin/dashboard'),
	categories: require('./admin/categories'),
	privileges: require('./admin/privileges'),
	adminsMods: require('./admin/admins-mods'),
	tags: require('./admin/tags'),
	groups: require('./admin/groups'),
	digest: require('./admin/digest'),
	appearance: require('./admin/appearance'),
	extend: {
		widgets: require('./admin/widgets'),
		rewards: require('./admin/rewards'),
	},
	events: require('./admin/events'),
	hooks: require('./admin/hooks'),
	logs: require('./admin/logs'),
	errors: require('./admin/errors'),
	database: require('./admin/database'),
	cache: require('./admin/cache'),
	plugins: require('./admin/plugins'),
	settings: require('./admin/settings'),
	logger: require('./admin/logger'),
	themes: require('./admin/themes'),
	users: require('./admin/users'),
	uploads: require('./admin/uploads'),
	info: require('./admin/info'),
};


module.exports = adminController;
