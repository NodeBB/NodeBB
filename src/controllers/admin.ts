'use strict';

import privileges from '../privileges';
import helpers from './helpers';
import dashboard from './admin/dashboard';
import categories from './admin/categories';
import adminPrivileges from './admin/privileges';
import adminsMods from './admin/admins-mods';
import tags from './admin/tags';
import groups from './admin/groups';
import digest from './admin/digest';
import appearance from './admin/appearance';
import 	widgets from './admin/widgets';
import 	rewards from './admin/rewards';
import events from './admin/events';
import hooks from './admin/hooks';
import logs from './admin/logs';
import errors from './admin/errors';
import database from './admin/database';
import cache from './admin/cache';
import plugins from './admin/plugins';
import settings from './admin/settings';
import logger from './admin/logger';
import themes from './admin/themes';
import users from './admin/users';
import uploads from './admin/uploads';
import info from './admin/info';

const adminController = {
	dashboard, 
	categories,
	privileges,
	adminsMods,
	groups,
	digest,
	appearance,
	events,
	hooks,
	errors,
	database,
	plugins,
	adminPrivileges,
	settings,
	logger,
	themes,
	users,
	uploads,
	info,
} as any;

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
	} else if (privilegeSet['admin:groups']) {
		return helpers.redirect(res, 'admin/manage/groups');
	} else if (privilegeSet['admin:admins-mods']) {
		return helpers.redirect(res, 'admin/manage/admins-mods');
	} else if (privilegeSet['admin:tags']) {
		return helpers.redirect(res, 'admin/manage/tags');
	} else if (privilegeSet['admin:settings']) {
		return helpers.redirect(res, 'admin/settings/general');
	}

	return helpers.notAllowed(req, res);
};

export default adminController;
