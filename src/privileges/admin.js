
'use strict';

const _ = require('lodash');

const user = require('../user');
const groups = require('../groups');
const helpers = require('./helpers');
const plugins = require('../plugins');
const utils = require('../utils');

const privsAdmin = module.exports;

/**
 * Looking to add a new admin privilege via plugin/theme? Attach a hook to
 * `static:privileges.admin.init` and call .set() on the privilege map passed
 * in to your listener.
 */
const _privilegeMap = new Map([
	['admin:dashboard', { label: '[[admin/manage/privileges:admin-dashboard]]', type: 'admin' }],
	['admin:categories', { label: '[[admin/manage/privileges:admin-categories]]', type: 'admin' }],
	['admin:privileges', { label: '[[admin/manage/privileges:admin-privileges]]', type: 'admin' }],
	['admin:admins-mods', { label: '[[admin/manage/privileges:admin-admins-mods]]', type: 'admin' }],
	['admin:users', { label: '[[admin/manage/privileges:admin-users]]', type: 'admin' }],
	['admin:groups', { label: '[[admin/manage/privileges:admin-groups]]', type: 'admin' }],
	['admin:tags', { label: '[[admin/manage/privileges:admin-tags]]', type: 'admin' }],
	['admin:settings', { label: '[[admin/manage/privileges:admin-settings]]', type: 'admin' }],
]);

privsAdmin.init = async () => {
	await plugins.hooks.fire('static:privileges.admin.init', {
		privileges: _privilegeMap,
	});

	for (const [, value] of _privilegeMap) {
		if (value && !value.type) {
			value.type = 'other';
		}
	}
};

privsAdmin.getUserPrivilegeList = async () => await plugins.hooks.fire('filter:privileges.admin.list', Array.from(_privilegeMap.keys()));
privsAdmin.getGroupPrivilegeList = async () => await plugins.hooks.fire('filter:privileges.admin.groups.list', Array.from(_privilegeMap.keys()).map(privilege => `groups:${privilege}`));
privsAdmin.getPrivilegeList = async () => {
	const [user, group] = await Promise.all([
		privsAdmin.getUserPrivilegeList(),
		privsAdmin.getGroupPrivilegeList(),
	]);
	return user.concat(group);
};

// Mapping for a page route (via direct match or regexp) to a privilege
privsAdmin.routeMap = {
	dashboard: 'admin:dashboard',
	'manage/categories': 'admin:categories',
	'manage/privileges': 'admin:privileges',
	'manage/admins-mods': 'admin:admins-mods',
	'manage/users': 'admin:users',
	'manage/groups': 'admin:groups',
	'manage/tags': 'admin:tags',
	'settings/tags': 'admin:tags',
	'extend/plugins': 'admin:settings',
	'extend/widgets': 'admin:settings',
	'extend/rewards': 'admin:settings',
	// uploads
	'category/uploadpicture': 'admin:categories',
	uploadfavicon: 'admin:settings',
	uploadTouchIcon: 'admin:settings',
	uploadMaskableIcon: 'admin:settings',
	uploadlogo: 'admin:settings',
	uploadOgImage: 'admin:settings',
	uploadDefaultAvatar: 'admin:settings',
};
privsAdmin.routePrefixMap = {
	'dashboard/': 'admin:dashboard',
	'manage/categories/': 'admin:categories',
	'manage/privileges/': 'admin:privileges',
	'manage/groups/': 'admin:groups',
	'settings/': 'admin:settings',
	'appearance/': 'admin:settings',
	'plugins/': 'admin:settings',
};

// Mapping for socket call methods to a privilege
// In NodeBB v2, these socket calls will be removed in favour of xhr calls
privsAdmin.socketMap = {
	'admin.rooms.getAll': 'admin:dashboard',
	'admin.analytics.get': 'admin:dashboard',

	'admin.categories.copySettingsFrom': 'admin:categories',
	'admin.categories.copyPrivilegesToChildren': 'admin:privileges',
	'admin.categories.copyPrivilegesFrom': 'admin:privileges',
	'admin.categories.copyPrivilegesToAllCategories': 'admin:privileges',

	'admin.user.makeAdmins': 'admin:admins-mods',
	'admin.user.removeAdmins': 'admin:admins-mods',

	'admin.user.loadGroups': 'admin:users',
	'admin.groups.join': 'admin:users',
	'admin.groups.leave': 'admin:users',
	'admin.user.resetLockouts': 'admin:users',
	'admin.user.validateEmail': 'admin:users',
	'admin.user.sendValidationEmail': 'admin:users',
	'admin.user.sendPasswordResetEmail': 'admin:users',
	'admin.user.forcePasswordReset': 'admin:users',
	'admin.user.invite': 'admin:users',

	'admin.tags.create': 'admin:tags',
	'admin.tags.rename': 'admin:tags',
	'admin.tags.deleteTags': 'admin:tags',

	'admin.getSearchDict': 'admin:settings',
	'admin.config.setMultiple': 'admin:settings',
	'admin.config.remove': 'admin:settings',
	'admin.themes.getInstalled': 'admin:settings',
	'admin.themes.set': 'admin:settings',
	'admin.reloadAllSessions': 'admin:settings',
	'admin.settings.get': 'admin:settings',
	'admin.settings.set': 'admin:settings',
};

privsAdmin.resolve = (path) => {
	if (privsAdmin.routeMap.hasOwnProperty(path)) {
		return privsAdmin.routeMap[path];
	}

	const found = Object.entries(privsAdmin.routePrefixMap)
		.filter(entry => path.startsWith(entry[0]))
		.sort((entry1, entry2) => entry2[0].length - entry1[0].length);
	if (!found.length) {
		return undefined;
	}
	return found[0][1]; // [0] is path [1] is privilege
};

privsAdmin.list = async function (uid) {
	const privilegeLabels = Array.from(_privilegeMap.values()).map(data => data.label);
	const userPrivilegeList = await privsAdmin.getUserPrivilegeList();
	const groupPrivilegeList = await privsAdmin.getGroupPrivilegeList();

	// Restrict privileges column to superadmins
	if (!(await user.isAdministrator(uid))) {
		const idx = Array.from(_privilegeMap.keys()).indexOf('admin:privileges');
		privilegeLabels.splice(idx, 1);
		userPrivilegeList.splice(idx, 1);
		groupPrivilegeList.splice(idx, 1);
	}

	const labels = await utils.promiseParallel({
		users: plugins.hooks.fire('filter:privileges.admin.list_human', privilegeLabels.slice()),
		groups: plugins.hooks.fire('filter:privileges.admin.groups.list_human', privilegeLabels.slice()),
	});

	const keys = {
		users: userPrivilegeList,
		groups: groupPrivilegeList,
	};

	const payload = await utils.promiseParallel({
		labels,
		labelData: Array.from(_privilegeMap.values()),
		users: helpers.getUserPrivileges(0, keys.users),
		groups: helpers.getGroupPrivileges(0, keys.groups),
	});
	payload.keys = keys;

	return payload;
};

privsAdmin.get = async function (uid) {
	const userPrivilegeList = await privsAdmin.getUserPrivilegeList();
	const [userPrivileges, isAdministrator] = await Promise.all([
		helpers.isAllowedTo(userPrivilegeList, uid, 0),
		user.isAdministrator(uid),
	]);

	const combined = userPrivileges.map(allowed => allowed || isAdministrator);
	const privData = _.zipObject(userPrivilegeList, combined);

	privData.superadmin = isAdministrator;
	return await plugins.hooks.fire('filter:privileges.admin.get', privData);
};

privsAdmin.can = async function (privilege, uid) {
	const [isUserAllowedTo, isAdministrator] = await Promise.all([
		helpers.isAllowedTo(privilege, uid, [0]),
		user.isAdministrator(uid),
	]);
	return isAdministrator || isUserAllowedTo[0];
};

privsAdmin.canGroup = async function (privilege, groupName) {
	return await groups.isMember(groupName, `cid:0:privileges:groups:${privilege}`);
};

privsAdmin.give = async function (privileges, groupName) {
	await helpers.giveOrRescind(groups.join, privileges, 0, groupName);
	plugins.hooks.fire('action:privileges.admin.give', {
		privileges: privileges,
		groupNames: Array.isArray(groupName) ? groupName : [groupName],
	});
};

privsAdmin.rescind = async function (privileges, groupName) {
	await helpers.giveOrRescind(groups.leave, privileges, 0, groupName);
	plugins.hooks.fire('action:privileges.admin.rescind', {
		privileges: privileges,
		groupNames: Array.isArray(groupName) ? groupName : [groupName],
	});
};

privsAdmin.userPrivileges = async function (uid) {
	const userPrivilegeList = await privsAdmin.getUserPrivilegeList();
	return await helpers.userOrGroupPrivileges(0, uid, userPrivilegeList);
};

privsAdmin.groupPrivileges = async function (groupName) {
	const groupPrivilegeList = await privsAdmin.getGroupPrivilegeList();
	return await helpers.userOrGroupPrivileges(0, groupName, groupPrivilegeList);
};

privsAdmin.getUidsWithPrivilege = async function (privilege) {
	const uidsByCid = await helpers.getUidsWithPrivilege([0], privilege);
	return uidsByCid[0];
};
