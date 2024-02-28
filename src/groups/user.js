'use strict';

const db = require('../database');
const user = require('../user');

module.exports = function (Groups) {
	Groups.getUsersFromSet = async function (set, fields = []) {
		const uids = await db.getSetMembers(set);
		const userData = await user.getUsersFields(uids, fields);
		return userData.filter(u => u && u.uid);
	};

	Groups.getUserGroups = async function (uids) {
		return await Groups.getUserGroupsFromSet('groups:visible:createtime', uids);
	};

	Groups.getUserGroupsFromSet = async function (set, uids) {
		const memberOf = await Groups.getUserGroupMembership(set, uids);
		return await Promise.all(memberOf.map(memberOf => Groups.getGroupsData(memberOf)));
	};

	Groups.getUserGroupMembership = async function (set, uids) {
		const groupNames = await db.getSortedSetRevRange(set, 0, -1);
		return await Promise.all(uids.map(uid => findUserGroups(uid, groupNames)));
	};

	async function findUserGroups(uid, groupNames) {
		const isMembers = await Groups.isMemberOfGroups(uid, groupNames);
		return groupNames.filter((name, i) => isMembers[i]);
	}

	Groups.getUserInviteGroups = async function (uid) {
		let allGroups = await Groups.getNonPrivilegeGroups('groups:createtime', 0, -1);
		allGroups = allGroups.filter(group => !Groups.ephemeralGroups.includes(group.name));

		const publicGroups = allGroups.filter(group => group.hidden === 0 && group.system === 0 && group.private === 0);
		const adminModGroups = [
			{ name: 'administrators', displayName: 'administrators' },
			{ name: 'Global Moderators', displayName: 'Global Moderators' },
		];
		// Private (but not hidden)
		const privateGroups = allGroups.filter(group => group.hidden === 0 && group.system === 0 && group.private === 1);

		const [ownership, isAdmin, isGlobalMod] = await Promise.all([
			Promise.all(privateGroups.map(group => Groups.ownership.isOwner(uid, group.name))),
			user.isAdministrator(uid),
			user.isGlobalModerator(uid),
		]);
		const ownGroups = privateGroups.filter((group, index) => ownership[index]);

		let inviteGroups = [];
		if (isAdmin) {
			inviteGroups = inviteGroups.concat(adminModGroups).concat(privateGroups);
		} else if (isGlobalMod) {
			inviteGroups = inviteGroups.concat(privateGroups);
		} else {
			inviteGroups = inviteGroups.concat(ownGroups);
		}

		return inviteGroups
			.concat(publicGroups);
	};
};
