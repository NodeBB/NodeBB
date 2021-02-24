
'use strict';

const _ = require('lodash');

const categories = require('../categories');
const user = require('../user');
const groups = require('../groups');
const helpers = require('./helpers');
const plugins = require('../plugins');
const utils = require('../utils');

const privsCategories = module.exports;

privsCategories.privilegeLabels = [
	{ name: '[[admin/manage/privileges:find-category]]' },
	{ name: '[[admin/manage/privileges:access-category]]' },
	{ name: '[[admin/manage/privileges:access-topics]]' },
	{ name: '[[admin/manage/privileges:create-topics]]' },
	{ name: '[[admin/manage/privileges:reply-to-topics]]' },
	{ name: '[[admin/manage/privileges:tag-topics]]' },
	{ name: '[[admin/manage/privileges:edit-posts]]' },
	{ name: '[[admin/manage/privileges:view-edit-history]]' },
	{ name: '[[admin/manage/privileges:delete-posts]]' },
	{ name: '[[admin/manage/privileges:upvote-posts]]' },
	{ name: '[[admin/manage/privileges:downvote-posts]]' },
	{ name: '[[admin/manage/privileges:delete-topics]]' },
	{ name: '[[admin/manage/privileges:view_deleted]]' },
	{ name: '[[admin/manage/privileges:purge]]' },
	{ name: '[[admin/manage/privileges:moderate]]' },
];

privsCategories.userPrivilegeList = [
	'find',
	'read',
	'topics:read',
	'topics:create',
	'topics:reply',
	'topics:tag',
	'posts:edit',
	'posts:history',
	'posts:delete',
	'posts:upvote',
	'posts:downvote',
	'topics:delete',
	'posts:view_deleted',
	'purge',
	'moderate',
];

privsCategories.groupPrivilegeList = privsCategories.userPrivilegeList.map(privilege => `groups:${privilege}`);

privsCategories.privilegeList = privsCategories.userPrivilegeList.concat(privsCategories.groupPrivilegeList);

// Method used in admin/category controller to show all users/groups with privs in that given cid
privsCategories.list = async function (cid) {
	async function getLabels() {
		return await utils.promiseParallel({
			users: plugins.hooks.fire('filter:privileges.list_human', privsCategories.privilegeLabels.slice()),
			groups: plugins.hooks.fire('filter:privileges.groups.list_human', privsCategories.privilegeLabels.slice()),
		});
	}

	const keys = await utils.promiseParallel({
		users: plugins.hooks.fire('filter:privileges.list', privsCategories.userPrivilegeList.slice()),
		groups: plugins.hooks.fire('filter:privileges.groups.list', privsCategories.groupPrivilegeList.slice()),
	});

	const payload = await utils.promiseParallel({
		labels: getLabels(),
		users: helpers.getUserPrivileges(cid, keys.users),
		groups: helpers.getGroupPrivileges(cid, keys.groups),
	});
	payload.keys = keys;

	// This is a hack because I can't do {labels.users.length} to echo the count in templates.js
	payload.columnCountUser = payload.labels.users.length + 3;
	payload.columnCountUserOther = payload.labels.users.length - privsCategories.privilegeLabels.length;
	payload.columnCountGroup = payload.labels.groups.length + 3;
	payload.columnCountGroupOther = payload.labels.groups.length - privsCategories.privilegeLabels.length;
	return payload;
};

privsCategories.get = async function (cid, uid) {
	const privs = ['topics:create', 'topics:read', 'topics:tag', 'read'];

	const [userPrivileges, isAdministrator, isModerator] = await Promise.all([
		helpers.isAllowedTo(privs, uid, cid),
		user.isAdministrator(uid),
		user.isModerator(uid, cid),
	]);

	const combined = userPrivileges.map(allowed => allowed || isAdministrator);
	const privData = _.zipObject(privs, combined);
	const isAdminOrMod = isAdministrator || isModerator;

	return await plugins.hooks.fire('filter:privileges.categories.get', {
		...privData,
		cid: cid,
		uid: uid,
		editable: isAdminOrMod,
		view_deleted: isAdminOrMod,
		isAdminOrMod: isAdminOrMod,
	});
};

privsCategories.isAdminOrMod = async function (cid, uid) {
	if (parseInt(uid, 10) <= 0) {
		return false;
	}
	const [isAdmin, isMod] = await Promise.all([
		user.isAdministrator(uid),
		user.isModerator(uid, cid),
	]);
	return isAdmin || isMod;
};

privsCategories.isUserAllowedTo = async function (privilege, cid, uid) {
	if ((Array.isArray(privilege) && !privilege.length) || (Array.isArray(cid) && !cid.length)) {
		return [];
	}
	if (!cid) {
		return false;
	}
	const results = await helpers.isAllowedTo(privilege, uid, Array.isArray(cid) ? cid : [cid]);

	if (Array.isArray(results) && results.length) {
		return Array.isArray(cid) ? results : results[0];
	}
	return false;
};

privsCategories.can = async function (privilege, cid, uid) {
	if (!cid) {
		return false;
	}
	const [disabled, isAdmin, isAllowed] = await Promise.all([
		categories.getCategoryField(cid, 'disabled'),
		user.isAdministrator(uid),
		privsCategories.isUserAllowedTo(privilege, cid, uid),
	]);
	return !disabled && (isAllowed || isAdmin);
};

privsCategories.filterCids = async function (privilege, cids, uid) {
	if (!Array.isArray(cids) || !cids.length) {
		return [];
	}

	cids = _.uniq(cids);
	const [categoryData, allowedTo, isAdmin] = await Promise.all([
		categories.getCategoriesFields(cids, ['disabled']),
		helpers.isAllowedTo(privilege, uid, cids),
		user.isAdministrator(uid),
	]);
	return cids.filter(
		(cid, index) => !!cid && !categoryData[index].disabled && (allowedTo[index] || isAdmin)
	);
};

privsCategories.getBase = async function (privilege, cids, uid) {
	return await utils.promiseParallel({
		categories: categories.getCategoriesFields(cids, ['disabled']),
		allowedTo: helpers.isAllowedTo(privilege, uid, cids),
		view_deleted: helpers.isAllowedTo('posts:view_deleted', uid, cids),
		isAdmin: user.isAdministrator(uid),
	});
};

privsCategories.filterUids = async function (privilege, cid, uids) {
	if (!uids.length) {
		return [];
	}

	uids = _.uniq(uids);

	const [allowedTo, isAdmins] = await Promise.all([
		helpers.isUsersAllowedTo(privilege, uids, cid),
		user.isAdministrator(uids),
	]);
	return uids.filter((uid, index) => allowedTo[index] || isAdmins[index]);
};

privsCategories.give = async function (privileges, cid, members) {
	await helpers.giveOrRescind(groups.join, privileges, cid, members);
	plugins.hooks.fire('action:privileges.categories.give', {
		privileges: privileges,
		cids: Array.isArray(cid) ? cid : [cid],
		members: Array.isArray(members) ? members : [members],
	});
};

privsCategories.rescind = async function (privileges, cid, members) {
	await helpers.giveOrRescind(groups.leave, privileges, cid, members);
	plugins.hooks.fire('action:privileges.categories.rescind', {
		privileges: privileges,
		cids: Array.isArray(cid) ? cid : [cid],
		members: Array.isArray(members) ? members : [members],
	});
};

privsCategories.canMoveAllTopics = async function (currentCid, targetCid, uid) {
	const [isAdmin, isModerators] = await Promise.all([
		user.isAdministrator(uid),
		user.isModerator(uid, [currentCid, targetCid]),
	]);
	return isAdmin || !isModerators.includes(false);
};

privsCategories.userPrivileges = async function (cid, uid) {
	return await helpers.userOrGroupPrivileges(cid, uid, privsCategories.userPrivilegeList);
};

privsCategories.groupPrivileges = async function (cid, groupName) {
	return await helpers.userOrGroupPrivileges(cid, groupName, privsCategories.groupPrivilegeList);
};
