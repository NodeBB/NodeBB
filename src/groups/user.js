'use strict';

const db = require('../database');
const user = require('../user');

module.exports = function (Groups) {
	Groups.getUsersFromSet = async function (set, fields) {
		const uids = await db.getSetMembers(set);

		if (fields) {
			return await user.getUsersFields(uids, fields);
		}
		return await user.getUsersData(uids);
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
};
