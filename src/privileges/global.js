
'use strict';

const _ = require('lodash');

const user = require('../user');
const groups = require('../groups');
const helpers = require('./helpers');
const plugins = require('../plugins');
const utils = require('../utils');

const privsGlobal = module.exports;

privsGlobal.privilegeLabels = [
	{ name: '[[admin/manage/privileges:chat]]' },
	{ name: '[[admin/manage/privileges:upload-images]]' },
	{ name: '[[admin/manage/privileges:upload-files]]' },
	{ name: '[[admin/manage/privileges:signature]]' },
	{ name: '[[admin/manage/privileges:ban]]' },
	{ name: '[[admin/manage/privileges:invite]]' },
	{ name: '[[admin/manage/privileges:search-content]]' },
	{ name: '[[admin/manage/privileges:search-users]]' },
	{ name: '[[admin/manage/privileges:search-tags]]' },
	{ name: '[[admin/manage/privileges:view-users]]' },
	{ name: '[[admin/manage/privileges:view-tags]]' },
	{ name: '[[admin/manage/privileges:view-groups]]' },
	{ name: '[[admin/manage/privileges:allow-local-login]]' },
	{ name: '[[admin/manage/privileges:allow-group-creation]]' },
	{ name: '[[admin/manage/privileges:view-users-info]]' },
];

privsGlobal.userPrivilegeList = [
	'chat',
	'upload:post:image',
	'upload:post:file',
	'signature',
	'ban',
	'invite',
	'search:content',
	'search:users',
	'search:tags',
	'view:users',
	'view:tags',
	'view:groups',
	'local:login',
	'group:create',
	'view:users:info',
];

privsGlobal.groupPrivilegeList = privsGlobal.userPrivilegeList.map(privilege => `groups:${privilege}`);

privsGlobal.list = async function () {
	async function getLabels() {
		return await utils.promiseParallel({
			users: plugins.hooks.fire('filter:privileges.global.list_human', privsGlobal.privilegeLabels.slice()),
			groups: plugins.hooks.fire('filter:privileges.global.groups.list_human', privsGlobal.privilegeLabels.slice()),
		});
	}

	const keys = await utils.promiseParallel({
		users: plugins.hooks.fire('filter:privileges.global.list', privsGlobal.userPrivilegeList.slice()),
		groups: plugins.hooks.fire('filter:privileges.global.groups.list', privsGlobal.groupPrivilegeList.slice()),
	});

	const payload = await utils.promiseParallel({
		labels: getLabels(),
		users: helpers.getUserPrivileges(0, keys.users),
		groups: helpers.getGroupPrivileges(0, keys.groups),
	});
	payload.keys = keys;

	// This is a hack because I can't do {labels.users.length} to echo the count in templates.js
	payload.columnCount = payload.labels.users.length + 3;
	return payload;
};

privsGlobal.get = async function (uid) {
	const [userPrivileges, isAdministrator] = await Promise.all([
		helpers.isAllowedTo(privsGlobal.userPrivilegeList, uid, 0),
		user.isAdministrator(uid),
	]);

	const combined = userPrivileges.map(allowed => allowed || isAdministrator);
	const privData = _.zipObject(privsGlobal.userPrivilegeList, combined);

	return await plugins.hooks.fire('filter:privileges.global.get', privData);
};

privsGlobal.can = async function (privilege, uid) {
	const [isAdministrator, isUserAllowedTo] = await Promise.all([
		user.isAdministrator(uid),
		helpers.isAllowedTo(privilege, uid, [0]),
	]);
	return isAdministrator || isUserAllowedTo[0];
};

privsGlobal.canGroup = async function (privilege, groupName) {
	return await groups.isMember(groupName, `cid:0:privileges:groups:${privilege}`);
};

privsGlobal.filterUids = async function (privilege, uids) {
	const privCategories = require('./categories');
	return await privCategories.filterUids(privilege, 0, uids);
};

privsGlobal.give = async function (privileges, groupName) {
	await helpers.giveOrRescind(groups.join, privileges, 0, groupName);
	plugins.hooks.fire('action:privileges.global.give', {
		privileges: privileges,
		groupNames: Array.isArray(groupName) ? groupName : [groupName],
	});
};

privsGlobal.rescind = async function (privileges, groupName) {
	await helpers.giveOrRescind(groups.leave, privileges, 0, groupName);
	plugins.hooks.fire('action:privileges.global.rescind', {
		privileges: privileges,
		groupNames: Array.isArray(groupName) ? groupName : [groupName],
	});
};

privsGlobal.userPrivileges = async function (uid) {
	return await helpers.userOrGroupPrivileges(0, uid, privsGlobal.userPrivilegeList);
};

privsGlobal.groupPrivileges = async function (groupName) {
	return await helpers.userOrGroupPrivileges(0, groupName, privsGlobal.groupPrivilegeList);
};
