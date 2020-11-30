
'use strict';

const _ = require('lodash');

const categories = require('../categories');
const user = require('../user');
const groups = require('../groups');
const helpers = require('./helpers');
const plugins = require('../plugins');
const utils = require('../utils');

module.exports = function (privileges) {
	privileges.categories = {};

	// Method used in admin/category controller to show all users/groups with privs in that given cid
	privileges.categories.list = async function (cid) {
		async function getLabels() {
			return await utils.promiseParallel({
				users: plugins.hooks.fire('filter:privileges.list_human', privileges.privilegeLabels.slice()),
				groups: plugins.hooks.fire('filter:privileges.groups.list_human', privileges.privilegeLabels.slice()),
			});
		}

		const keys = await utils.promiseParallel({
			users: plugins.hooks.fire('filter:privileges.list', privileges.userPrivilegeList.slice()),
			groups: plugins.hooks.fire('filter:privileges.groups.list', privileges.groupPrivilegeList.slice()),
		});

		const payload = await utils.promiseParallel({
			labels: getLabels(),
			users: helpers.getUserPrivileges(cid, keys.users),
			groups: helpers.getGroupPrivileges(cid, keys.groups),
		});
		payload.keys = keys;

		// This is a hack because I can't do {labels.users.length} to echo the count in templates.js
		payload.columnCountUser = payload.labels.users.length + 3;
		payload.columnCountUserOther = payload.labels.users.length - privileges.privilegeLabels.length;
		payload.columnCountGroup = payload.labels.groups.length + 3;
		payload.columnCountGroupOther = payload.labels.groups.length - privileges.privilegeLabels.length;
		return payload;
	};

	privileges.categories.get = async function (cid, uid) {
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

	privileges.categories.isAdminOrMod = async function (cid, uid) {
		if (parseInt(uid, 10) <= 0) {
			return false;
		}
		const [isAdmin, isMod] = await Promise.all([
			user.isAdministrator(uid),
			user.isModerator(uid, cid),
		]);
		return isAdmin || isMod;
	};

	privileges.categories.isUserAllowedTo = async function (privilege, cid, uid) {
		if (!cid) {
			return false;
		}
		const results = await helpers.isAllowedTo(privilege, uid, Array.isArray(cid) ? cid : [cid]);

		if (Array.isArray(results) && results.length) {
			return Array.isArray(cid) ? results : results[0];
		}
		return false;
	};

	privileges.categories.can = async function (privilege, cid, uid) {
		if (!cid) {
			return false;
		}
		const [disabled, isAdmin, isAllowed] = await Promise.all([
			categories.getCategoryField(cid, 'disabled'),
			user.isAdministrator(uid),
			privileges.categories.isUserAllowedTo(privilege, cid, uid),
		]);
		return !disabled && (isAllowed || isAdmin);
	};

	privileges.categories.filterCids = async function (privilege, cids, uid) {
		if (!Array.isArray(cids) || !cids.length) {
			return [];
		}

		cids = _.uniq(cids);
		const results = await privileges.categories.getBase(privilege, cids, uid);
		return cids.filter((cid, index) => !!cid && !results.categories[index].disabled && (results.allowedTo[index] || results.isAdmin));
	};

	privileges.categories.getBase = async function (privilege, cids, uid) {
		return await utils.promiseParallel({
			categories: categories.getCategoriesFields(cids, ['disabled']),
			allowedTo: helpers.isAllowedTo(privilege, uid, cids),
			view_deleted: helpers.isAllowedTo('posts:view_deleted', uid, cids),
			isAdmin: user.isAdministrator(uid),
		});
	};

	privileges.categories.filterUids = async function (privilege, cid, uids) {
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

	privileges.categories.give = async function (privileges, cid, members) {
		await helpers.giveOrRescind(groups.join, privileges, cid, members);
		plugins.hooks.fire('action:privileges.categories.give', {
			privileges: privileges,
			cids: Array.isArray(cid) ? cid : [cid],
			members: Array.isArray(members) ? members : [members],
		});
	};

	privileges.categories.rescind = async function (privileges, cid, members) {
		await helpers.giveOrRescind(groups.leave, privileges, cid, members);
		plugins.hooks.fire('action:privileges.categories.rescind', {
			privileges: privileges,
			cids: Array.isArray(cid) ? cid : [cid],
			members: Array.isArray(members) ? members : [members],
		});
	};

	privileges.categories.canMoveAllTopics = async function (currentCid, targetCid, uid) {
		const [isAdmin, isModerators] = await Promise.all([
			user.isAdministrator(uid),
			user.isModerator(uid, [currentCid, targetCid]),
		]);
		return isAdmin || !isModerators.includes(false);
	};

	privileges.categories.userPrivileges = async function (cid, uid) {
		const tasks = {};
		privileges.userPrivilegeList.forEach(function (privilege) {
			tasks[privilege] = groups.isMember(uid, 'cid:' + cid + ':privileges:' + privilege);
		});
		return await utils.promiseParallel(tasks);
	};

	privileges.categories.groupPrivileges = async function (cid, groupName) {
		const tasks = {};
		privileges.groupPrivilegeList.forEach(function (privilege) {
			tasks[privilege] = groups.isMember(groupName, 'cid:' + cid + ':privileges:' + privilege);
		});
		return await utils.promiseParallel(tasks);
	};
};
