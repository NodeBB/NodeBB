'use strict';

const _ = require('lodash');

const db = require('../database');
const user = require('../user');
const cache = require('../cache');
const utils = require('../utils');

module.exports = function (Groups) {
	Groups.getMembers = async function (groupName, start, stop) {
		return await db.getSortedSetRevRange(`group:${groupName}:members`, start, stop);
	};

	Groups.getMemberUsers = async function (groupNames, start, stop) {
		async function get(groupName) {
			const uids = await Groups.getMembers(groupName, start, stop);
			return await user.getUsersFields(uids, ['uid', 'username', 'picture', 'userslug']);
		}
		return await Promise.all(groupNames.map(name => get(name)));
	};

	Groups.getMembersOfGroups = async function (groupNames) {
		return await db.getSortedSetsMembers(groupNames.map(name => `group:${name}:members`));
	};

	Groups.isMember = async function (uid, groupName) {
		if (!uid || (utils.isNumber(uid) && parseInt(uid, 10) <= 0) || !groupName) {
			return isMemberOfEphemeralGroup(uid, groupName);
		}

		const isMember = await Groups.cache.get(
			`${uid}:${groupName}`, () => db.isSortedSetMember(`group:${groupName}:members`, uid)
		);
		return isMember;
	};

	Groups.isMembers = async function (uids, groupName) {
		if (!groupName || !uids.length) {
			return uids.map(() => false);
		}

		if (groupName === 'guests' || groupName === 'spiders') {
			return uids.map(uid => isMemberOfEphemeralGroup(uid, groupName));
		}
		const cacheKeys = uids.map(uid => `${uid}:${groupName}`);
		const isMembers = await Groups.cache.getMany(
			cacheKeys,
			async (uncachedKeys, uncachedIndexes) => {
				const uncachedUids = uncachedIndexes.map(index => uids[index]);
				return await db.isSortedSetMembers(`group:${groupName}:members`, uncachedUids);
			}
		);
		return isMembers.slice();
	};

	Groups.isMemberOfGroups = async function (uid, groups) {
		if (!uid || (utils.isNumber(uid) && parseInt(uid, 10) <= 0) || !groups.length) {
			return groups.map(groupName => isMemberOfEphemeralGroup(uid, groupName));
		}
		const keys = groups.map(groupName => `${uid}:${groupName}`);

		return await Groups.cache.getMany(keys, async (uncachedKeys, uncachedIndexes) => {
			const nonCachedGroupsMemberSets = uncachedIndexes.map(index => (
				`group:${groups[index]}:members`
			));

			return await db.isMemberOfSortedSets(nonCachedGroupsMemberSets, uid);
		});
	};

	function isMemberOfEphemeralGroup(uid, groupName) {
		// uid can be a groupname too dont parseInt in that case
		const parsedUid = utils.isNumber(uid) ? parseInt(uid, 10) : uid;
		return (groupName === 'guests' && parsedUid === 0) ||
			(groupName === 'spiders' && parsedUid === -1);
	}

	Groups.isMemberOfAny = async function (uid, groups) {
		if (!Array.isArray(groups) || !groups.length) {
			return false;
		}
		const isMembers = await Groups.isMemberOfGroups(uid, groups);
		return isMembers.includes(true);
	};

	Groups.getMemberCount = async function (groupName) {
		const count = await db.getObjectField(`group:${groupName}`, 'memberCount');
		return parseInt(count, 10);
	};

	Groups.isMemberOfGroupList = async function (uid, groupListKey) {
		let groupNames = await getGroupNames(groupListKey);
		groupNames = Groups.removeEphemeralGroups(groupNames);
		if (!groupNames.length) {
			return false;
		}

		const isMembers = await Groups.isMemberOfGroups(uid, groupNames);
		return isMembers.includes(true);
	};

	Groups.isMemberOfGroupsList = async function (uid, groupListKeys) {
		const members = await getGroupNames(groupListKeys);

		let uniqueGroups = _.uniq(_.flatten(members));
		uniqueGroups = Groups.removeEphemeralGroups(uniqueGroups);

		const isMembers = await Groups.isMemberOfGroups(uid, uniqueGroups);
		const isGroupMember = _.zipObject(uniqueGroups, isMembers);

		return members.map(groupNames => !!groupNames.find(name => isGroupMember[name]));
	};

	Groups.isMembersOfGroupList = async function (uids, groupListKey) {
		const results = uids.map(() => false);

		let groupNames = await getGroupNames(groupListKey);
		groupNames = Groups.removeEphemeralGroups(groupNames);
		if (!groupNames.length) {
			return results;
		}
		const isGroupMembers = await Promise.all(groupNames.map(name => Groups.isMembers(uids, name)));

		isGroupMembers.forEach((isMembers) => {
			results.forEach((isMember, index) => {
				if (!isMember && isMembers[index]) {
					results[index] = true;
				}
			});
		});
		return results;
	};

	async function getGroupNames(keys) {
		const isArray = Array.isArray(keys);
		keys = isArray ? keys : [keys];

		const cacheKeys = keys.map(groupName => `group:${groupName}:members`);
		const groupMembers = await cache.getMany(
			cacheKeys, uncachedKeys => db.getSortedSetsMembers(uncachedKeys)
		);

		return isArray ? groupMembers : groupMembers[0];
	}
};
