
'use strict';

const _ = require('lodash');

const groups = require('../groups');
const plugins = require('../plugins');
const helpers = require('./helpers');

module.exports = function (privileges) {
	privileges.users = {};

	privileges.users.isAdministrator = async function (uid) {
		return await isGroupMember(uid, 'administrators');
	};

	privileges.users.isGlobalModerator = async function (uid) {
		return await isGroupMember(uid, 'Global Moderators');
	};

	async function isGroupMember(uid, groupName) {
		return await groups[Array.isArray(uid) ? 'isMembers' : 'isMember'](uid, groupName);
	}

	privileges.users.isModerator = async function (uid, cid) {
		if (Array.isArray(cid)) {
			return await isModeratorOfCategories(cid, uid);
		} else if (Array.isArray(uid)) {
			return await isModeratorsOfCategory(cid, uid);
		}
		return await isModeratorOfCategory(cid, uid);
	};

	async function isModeratorOfCategories(cids, uid) {
		if (parseInt(uid, 10) <= 0) {
			return await filterIsModerator(cids, uid, cids.map(() => false));
		}

		const isGlobalModerator = await privileges.users.isGlobalModerator(uid);
		if (isGlobalModerator) {
			return await filterIsModerator(cids, uid, cids.map(() => true));
		}
		const uniqueCids = _.uniq(cids);
		const isAllowed = await helpers.isAllowedTo('moderate', uid, uniqueCids);

		const cidToIsAllowed = _.zipObject(uniqueCids, isAllowed);
		const isModerator = cids.map(cid => cidToIsAllowed[cid]);
		return await filterIsModerator(cids, uid, isModerator);
	}

	async function isModeratorsOfCategory(cid, uids) {
		const [check1, check2, check3] = await Promise.all([
			privileges.users.isGlobalModerator(uids),
			groups.isMembers(uids, 'cid:' + cid + ':privileges:moderate'),
			groups.isMembersOfGroupList(uids, 'cid:' + cid + ':privileges:groups:moderate'),
		]);
		const isModerator = uids.map((uid, idx) => check1[idx] || check2[idx] || check3[idx]);
		return await filterIsModerator(cid, uids, isModerator);
	}

	async function isModeratorOfCategory(cid, uid) {
		const result = await isModeratorOfCategories([cid], uid);
		return result ? result[0] : false;
	}

	async function filterIsModerator(cid, uid, isModerator) {
		const data = await plugins.fireHook('filter:user.isModerator', { uid: uid, cid: cid, isModerator: isModerator });
		if ((Array.isArray(uid) || Array.isArray(cid)) && !Array.isArray(data.isModerator)) {
			throw new Error('filter:user.isModerator - i/o mismatch');
		}

		return data.isModerator;
	}

	privileges.users.canEdit = async function (callerUid, uid) {
		if (parseInt(callerUid, 10) === parseInt(uid, 10)) {
			return true;
		}
		const [isAdmin, isGlobalMod, isTargetAdmin] = await Promise.all([
			privileges.users.isAdministrator(callerUid),
			privileges.users.isGlobalModerator(callerUid),
			privileges.users.isAdministrator(uid),
		]);

		const data = await plugins.fireHook('filter:user.canEdit', {
			isAdmin: isAdmin,
			isGlobalMod: isGlobalMod,
			isTargetAdmin: isTargetAdmin,
			canEdit: isAdmin || (isGlobalMod && !isTargetAdmin),
			callerUid: callerUid,
			uid: uid,
		});
		return data.canEdit;
	};

	privileges.users.canBanUser = async function (callerUid, uid) {
		const [canBan, isTargetAdmin] = await Promise.all([
			privileges.global.can('ban', callerUid),
			privileges.users.isAdministrator(uid),
		]);

		const data = await plugins.fireHook('filter:user.canBanUser', {
			canBan: canBan && !isTargetAdmin,
			callerUid: callerUid,
			uid: uid,
		});
		return data.canBan;
	};

	privileges.users.hasBanPrivilege = async function (uid) {
		const canBan = await privileges.global.can('ban', uid);
		const data = await plugins.fireHook('filter:user.hasBanPrivilege', {
			uid: uid,
			canBan: canBan,
		});
		return data.canBan;
	};
};
