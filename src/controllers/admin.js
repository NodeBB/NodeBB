'use strict';

const privileges = require('../privileges');
const helpers = require('./helpers');

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

adminController.routeIndex = async (req, res) => {
	const privilegeSet = await privileges.admin.get(req.uid);

	if (privilegeSet.superadmin || privilegeSet['admin:dashboard']) {
		return adminController.dashboard.get(req, res);
	} else if (privilegeSet['admin:categories']) {
		return helpers.redirect(res, 'admin/manage/categories');
	} else if (privilegeSet['admin:privileges']) {
		return helpers.redirect(res, 'admin/manage/privileges');
	} else if (privilegeSet['admin:users']) {
		return helpers.redirect(res, 'admin/manage/users');
	} else if (privilegeSet['admin:settings']) {
		return helpers.redirect(res, 'admin/settings/general');
	}

	return helpers.notAllowed(req, res);
};

module.exports = adminController;
