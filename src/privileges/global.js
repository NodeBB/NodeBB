
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
	['chat', { label: '[[admin/manage/privileges:chat]]', type: 'posting' }],
	['chat:privileged', { label: '[[admin/manage/privileges:chat-with-privileged]]', type: 'posting' }],
	['upload:post:image', { label: '[[admin/manage/privileges:upload-images]]', type: 'posting' }],
	['upload:post:file', { label: '[[admin/manage/privileges:upload-files]]', type: 'posting' }],
	['signature', { label: '[[admin/manage/privileges:signature]]', type: 'posting' }],
	['invite', { label: '[[admin/manage/privileges:invite]]', type: 'posting' }],
	['group:create', { label: '[[admin/manage/privileges:allow-group-creation]]', type: 'posting' }],
	['search:content', { label: '[[admin/manage/privileges:search-content]]', type: 'viewing' }],
	['search:users', { label: '[[admin/manage/privileges:search-users]]', type: 'viewing' }],
	['search:tags', { label: '[[admin/manage/privileges:search-tags]]', type: 'viewing' }],
	['view:users', { label: '[[admin/manage/privileges:view-users]]', type: 'viewing' }],
	['view:tags', { label: '[[admin/manage/privileges:view-tags]]', type: 'viewing' }],
	['view:groups', { label: '[[admin/manage/privileges:view-groups]]', type: 'viewing' }],
	['local:login', { label: '[[admin/manage/privileges:allow-local-login]]', type: 'viewing' }],
	['ban', { label: '[[admin/manage/privileges:ban]]', type: 'moderation' }],
	['mute', { label: '[[admin/manage/privileges:mute]]', type: 'moderation' }],
	['view:users:info', { label: '[[admin/manage/privileges:view-users-info]]', type: 'moderation' }],
]);

privsGlobal.init = async () => {
	privsGlobal._coreSize = _privilegeMap.size;
	await plugins.hooks.fire('static:privileges.global.init', {
		privileges: _privilegeMap,
	});

	for (const [, value] of _privilegeMap) {
		if (value && !value.type) {
			value.type = 'other';
		}
	}
};

privsGlobal.getType = function (privilege) {
	const priv = _privilegeMap.get(privilege);
	return priv && priv.type ? priv.type : '';
};

privsGlobal.getUserPrivilegeList = async () => await plugins.hooks.fire('filter:privileges.global.list', Array.from(_privilegeMap.keys()));
privsGlobal.getGroupPrivilegeList = async () => await plugins.hooks.fire('filter:privileges.global.groups.list', Array.from(_privilegeMap.keys()).map(privilege => `groups:${privilege}`));
privsGlobal.getPrivilegeList = async () => {
	const [user, group] = await Promise.all([
		privsGlobal.getUserPrivilegeList(),
		privsGlobal.getGroupPrivilegeList(),
	]);
	return user.concat(group);
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
		labelData: Array.from(_privilegeMap.values()),
		users: helpers.getUserPrivileges(0, keys.users),
		groups: helpers.getGroupPrivileges(0, keys.groups),
	});
	payload.keys = keys;

	payload.columnCountUserOther = keys.users.length - privsGlobal._coreSize;
	payload.columnCountGroupOther = keys.groups.length - privsGlobal._coreSize;

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
	const isArray = Array.isArray(privilege);
	const [isAdministrator, isUserAllowedTo] = await Promise.all([
		user.isAdministrator(uid),
		helpers.isAllowedTo(isArray ? privilege : [privilege], uid, 0),
	]);
	return isArray ?
		isUserAllowedTo.map(allowed => isAdministrator || allowed) :
		isAdministrator || isUserAllowedTo[0];
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

privsGlobal.getUidsWithPrivilege = async function (privilege) {
	const uidsByCid = await helpers.getUidsWithPrivilege([0], privilege);
	return uidsByCid[0];
};
