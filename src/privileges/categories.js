
'use strict';

const _ = require('lodash');

const categories = require('../categories');
const user = require('../user');
const groups = require('../groups');
const helpers = require('./helpers');
const plugins = require('../plugins');
const utils = require('../utils');

const privsCategories = module.exports;

/**
 * Looking to add a new category privilege via plugin/theme? Attach a hook to
 * `static:privileges.category.init` and call .set() on the privilege map passed
 * in to your listener.
 */
const _privilegeMap = new Map([
	['find', { label: '[[admin/manage/privileges:find-category]]' }],
	['read', { label: '[[admin/manage/privileges:access-category]]' }],
	['topics:read', { label: '[[admin/manage/privileges:access-topics]]' }],
	['topics:create', { label: '[[admin/manage/privileges:create-topics]]' }],
	['topics:reply', { label: '[[admin/manage/privileges:reply-to-topics]]' }],
	['topics:schedule', { label: '[[admin/manage/privileges:schedule-topics]]' }],
	['topics:tag', { label: '[[admin/manage/privileges:tag-topics]]' }],
	['posts:edit', { label: '[[admin/manage/privileges:edit-posts]]' }],
	['posts:history', { label: '[[admin/manage/privileges:view-edit-history]]' }],
	['posts:delete', { label: '[[admin/manage/privileges:delete-posts]]' }],
	['posts:upvote', { label: '[[admin/manage/privileges:upvote-posts]]' }],
	['posts:downvote', { label: '[[admin/manage/privileges:downvote-posts]]' }],
	['topics:delete', { label: '[[admin/manage/privileges:delete-topics]]' }],
	['posts:view_deleted', { label: '[[admin/manage/privileges:view_deleted]]' }],
	['purge', { label: '[[admin/manage/privileges:purge]]' }],
	['moderate', { label: '[[admin/manage/privileges:moderate]]' }],
]);

privsCategories.getUserPrivilegeList = async () => await plugins.hooks.fire('filter:privileges.list', Array.from(_privilegeMap.keys()));
privsCategories.getGroupPrivilegeList = async () => await plugins.hooks.fire('filter:privileges.groups.list', Array.from(_privilegeMap.keys()).map(privilege => `groups:${privilege}`));
privsCategories.getPrivilegeList = async () => {
	const [user, group] = await Promise.all([
		privsCategories.getUserPrivilegeList(),
		privsCategories.getGroupPrivilegeList(),
	]);
	return user.concat(group);
};

privsCategories.init = async () => {
	await plugins.hooks.fire('static:privileges.categories.init', {
		privileges: _privilegeMap,
	});
};

// Method used in admin/category controller to show all users/groups with privs in that given cid
privsCategories.list = async function (cid) {
	let labels = Array.from(_privilegeMap.values()).map(data => data.label);
	labels = await utils.promiseParallel({
		users: plugins.hooks.fire('filter:privileges.list_human', labels.slice()),
		groups: plugins.hooks.fire('filter:privileges.groups.list_human', labels.slice()),
	});

	const keys = await utils.promiseParallel({
		users: privsCategories.getUserPrivilegeList(),
		groups: privsCategories.getGroupPrivilegeList(),
	});

	const payload = await utils.promiseParallel({
		labels,
		users: helpers.getUserPrivileges(cid, keys.users),
		groups: helpers.getGroupPrivileges(cid, keys.groups),
	});
	payload.keys = keys;

	payload.columnCountUserOther = payload.labels.users.length - labels.users.length;
	payload.columnCountGroupOther = payload.labels.groups.length - labels.groups.length;

	return payload;
};

privsCategories.get = async function (cid, uid) {
	const privs = [
		'topics:create', 'topics:read', 'topics:schedule',
		'topics:tag', 'read', 'posts:view_deleted',
	];

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
		view_deleted: isAdminOrMod || privData['posts:view_deleted'],
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
		view_scheduled: helpers.isAllowedTo('topics:schedule', uid, cids),
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
	const userPrivilegeList = await privsCategories.getUserPrivilegeList();
	return await helpers.userOrGroupPrivileges(cid, uid, userPrivilegeList);
};

privsCategories.groupPrivileges = async function (cid, groupName) {
	const groupPrivilegeList = await privsCategories.getGroupPrivilegeList();
	return await helpers.userOrGroupPrivileges(cid, groupName, groupPrivilegeList);
};
