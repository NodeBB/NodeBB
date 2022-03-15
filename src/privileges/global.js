
'use strict';

const _ = require('lodash');

const user = require('../user');
const groups = require('../groups');
const helpers = require('./helpers');
const plugins = require('../plugins');
const utils = require('../utils');

const privsGlobal = module.exports;

/**
 * Looking to add a new global privilege via plugin/theme? Attach a hook to
 * `static:privileges.global.init` and call .set() on the privilege map passed
 * in to your listener.
 */
const _privilegeMap = new Map([
	['chat', { label: '[[admin/manage/privileges:chat]]' }],
	['upload:post:image', { label: '[[admin/manage/privileges:upload-images]]' }],
	['upload:post:file', { label: '[[admin/manage/privileges:upload-files]]' }],
	['signature', { label: '[[admin/manage/privileges:signature]]' }],
	['invite', { label: '[[admin/manage/privileges:invite]]' }],
	['group:create', { label: '[[admin/manage/privileges:allow-group-creation]]' }],
	['search:content', { label: '[[admin/manage/privileges:search-content]]' }],
	['search:users', { label: '[[admin/manage/privileges:search-users]]' }],
	['search:tags', { label: '[[admin/manage/privileges:search-tags]]' }],
	['view:users', { label: '[[admin/manage/privileges:view-users]]' }],
	['view:tags', { label: '[[admin/manage/privileges:view-tags]]' }],
	['view:groups', { label: '[[admin/manage/privileges:view-groups]]' }],
	['local:login', { label: '[[admin/manage/privileges:allow-local-login]]' }],
	['ban', { label: '[[admin/manage/privileges:ban]]' }],
	['mute', { label: '[[admin/manage/privileges:mute]]' }],
	['view:users:info', { label: '[[admin/manage/privileges:view-users-info]]' }],
]);

privsGlobal.getUserPrivilegeList = async () => await plugins.hooks.fire('filter:privileges.global.list', Array.from(_privilegeMap.keys()));
privsGlobal.getGroupPrivilegeList = async () => await plugins.hooks.fire('filter:privileges.global.groups.list', Array.from(_privilegeMap.keys()).map(privilege => `groups:${privilege}`));
privsGlobal.getPrivilegeList = async () => {
	const [user, group] = await Promise.all([
		privsGlobal.getUserPrivilegeList(),
		privsGlobal.getGroupPrivilegeList(),
	]);
	return user.concat(group);
};

privsGlobal.init = async () => {
	await plugins.hooks.fire('static:privileges.global.init', {
		privileges: _privilegeMap,
	});
};

privsGlobal.list = async function () {
	async function getLabels() {
		const labels = Array.from(_privilegeMap.values()).map(data => data.label);
		return await utils.promiseParallel({
			users: plugins.hooks.fire('filter:privileges.global.list_human', labels.slice()),
			groups: plugins.hooks.fire('filter:privileges.global.groups.list_human', labels.slice()),
		});
	}

	const keys = await utils.promiseParallel({
		users: privsGlobal.getUserPrivilegeList(),
		groups: privsGlobal.getGroupPrivilegeList(),
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
	const userPrivilegeList = await privsGlobal.getUserPrivilegeList();
	const [userPrivileges, isAdministrator] = await Promise.all([
		helpers.isAllowedTo(userPrivilegeList, uid, 0),
		user.isAdministrator(uid),
	]);

	const combined = userPrivileges.map(allowed => allowed || isAdministrator);
	const privData = _.zipObject(userPrivilegeList, combined);

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
	const userPrivilegeList = await privsGlobal.getUserPrivilegeList();
	return await helpers.userOrGroupPrivileges(0, uid, userPrivilegeList);
};

privsGlobal.groupPrivileges = async function (groupName) {
	const groupPrivilegeList = await privsGlobal.getGroupPrivilegeList();
	return await helpers.userOrGroupPrivileges(0, groupName, groupPrivilegeList);
};
