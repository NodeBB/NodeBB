
'use strict';

const _ = require('lodash');

const user = require('../user');
const groups = require('../groups');
const helpers = require('./helpers');
const plugins = require('../plugins');
const utils = require('../utils');

const privsAdmin = module.exports;

privsAdmin.privilegeLabels = [
	{ name: '[[admin/manage/privileges:admin-dashboard]]' },
	{ name: '[[admin/manage/privileges:admin-categories]]' },
	{ name: '[[admin/manage/privileges:admin-privileges]]' },
	{ name: '[[admin/manage/privileges:admin-admins-mods]]' },
	{ name: '[[admin/manage/privileges:admin-users]]' },
	{ name: '[[admin/manage/privileges:admin-groups]]' },
	{ name: '[[admin/manage/privileges:admin-tags]]' },
	{ name: '[[admin/manage/privileges:admin-settings]]' },
];

privsAdmin.userPrivilegeList = [
	'admin:dashboard',
	'admin:categories',
	'admin:privileges',
	'admin:admins-mods',
	'admin:users',
	'admin:groups',
	'admin:tags',
	'admin:settings',
];

privsAdmin.groupPrivilegeList = privsAdmin.userPrivilegeList.map(privilege => `groups:${privilege}`);

privsAdmin.privilegeList = privsAdmin.userPrivilegeList.concat(privsAdmin.groupPrivilegeList);

privsAdmin.getUserPrivilegeList = async () => await plugins.hooks.fire('filter:privileges.admin.list', privsAdmin.userPrivilegeList.slice());
privsAdmin.getGroupPrivilegeList = async () => await plugins.hooks.fire('filter:privileges.admin.groups.list', privsAdmin.groupPrivilegeList.slice());
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
};
privsAdmin.routePrefixMap = {
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

	'admin.categories.getPrivilegeSettings': 'admin:privileges',
	'admin.categories.setPrivilege': 'admin:privileges;admin:admins-mods',
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

	const found = Object.entries(privsAdmin.routePrefixMap).find(entry => path.startsWith(entry[0]));
	return found ? found[1] : undefined;
};

privsAdmin.list = async function (uid) {
	const privilegeLabels = privsAdmin.privilegeLabels.slice();
	const userPrivilegeList = privsAdmin.userPrivilegeList.slice();
	const groupPrivilegeList = privsAdmin.groupPrivilegeList.slice();

	// Restrict privileges column to superadmins
	if (!(await user.isAdministrator(uid))) {
		const idx = privsAdmin.userPrivilegeList.indexOf('admin:privileges');
		privilegeLabels.splice(idx, 1);
		userPrivilegeList.splice(idx, 1);
		groupPrivilegeList.splice(idx, 1);
	}

	const labels = await utils.promiseParallel({
		users: plugins.hooks.fire('filter:privileges.admin.list_human', privilegeLabels.slice()),
		groups: plugins.hooks.fire('filter:privileges.admin.groups.list_human', privilegeLabels.slice()),
	});

	const keys = await utils.promiseParallel({
		users: plugins.hooks.fire('filter:privileges.admin.list', userPrivilegeList.slice()),
		groups: plugins.hooks.fire('filter:privileges.admin.groups.list', groupPrivilegeList.slice()),
	});

	const payload = await utils.promiseParallel({
		labels,
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
