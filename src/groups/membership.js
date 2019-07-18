'use strict';

const _ = require('lodash');

const db = require('../database');
const user = require('../user');

module.exports = function (Groups) {
	Groups.getMembers = async function (groupName, start, stop) {
		return await db.getSortedSetRevRange('group:' + groupName + ':members', start, stop);
	};

	Groups.getMemberUsers = async function (groupNames, start, stop) {
		async function get(groupName) {
			const uids = await Groups.getMembers(groupName, start, stop);
			return await user.getUsersFields(uids, ['uid', 'username', 'picture', 'userslug']);
		}
		return await Promise.all(groupNames.map(name => get(name)));
	};

	Groups.getMembersOfGroups = async function (groupNames) {
		return await db.getSortedSetsMembers(groupNames.map(name => 'group:' + name + ':members'));
	};

	Groups.isMember = async function (uid, groupName) {
		if (!uid || parseInt(uid, 10) <= 0 || !groupName) {
			return false;
		}

		const cacheKey = uid + ':' + groupName;
		let isMember = Groups.cache.get(cacheKey);
		if (isMember !== undefined) {
			Groups.cache.hits += 1;
			return isMember;
		}
		Groups.cache.misses += 1;
		isMember = await db.isSortedSetMember('group:' + groupName + ':members', uid);
		Groups.cache.set(cacheKey, isMember);
		return isMember;
	};

	Groups.isMembers = async function (uids, groupName) {
		if (!groupName || !uids.length) {
			return uids.map(() => false);
		}

		if (groupName === 'guests') {
			return uids.map(uid => parseInt(uid, 10) === 0);
		}

		const cachedData = {};
		const nonCachedUids = uids.filter(uid => filterNonCached(cachedData, uid, groupName));

		if (!nonCachedUids.length) {
			return uids.map(uid => cachedData[uid + ':' + groupName]);
		}

		const isMembers = await db.isSortedSetMembers('group:' + groupName + ':members', nonCachedUids);
		nonCachedUids.forEach(function (uid, index) {
			cachedData[uid + ':' + groupName] = isMembers[index];
			Groups.cache.set(uid + ':' + groupName, isMembers[index]);
		});
		return uids.map(uid => cachedData[uid + ':' + groupName]);
	};

	Groups.isMemberOfGroups = async function (uid, groups) {
		if (!uid || parseInt(uid, 10) <= 0 || !groups.length) {
			return groups.map(groupName => groupName === 'guests');
		}
		const cachedData = {};
		const nonCachedGroups = groups.filter(groupName => filterNonCached(cachedData, uid, groupName));

		if (!nonCachedGroups.length) {
			return groups.map(groupName => cachedData[uid + ':' + groupName]);
		}
		const nonCachedGroupsMemberSets = nonCachedGroups.map(groupName => 'group:' + groupName + ':members');
		const isMembers = await db.isMemberOfSortedSets(nonCachedGroupsMemberSets, uid);
		nonCachedGroups.forEach(function (groupName, index) {
			cachedData[uid + ':' + groupName] = isMembers[index];
			Groups.cache.set(uid + ':' + groupName, isMembers[index]);
		});

		return groups.map(groupName => cachedData[uid + ':' + groupName]);
	};

	function filterNonCached(cachedData, uid, groupName) {
		const isMember = Groups.cache.get(uid + ':' + groupName);
		const isInCache = isMember !== undefined;
		if (isInCache) {
			Groups.cache.hits += 1;
			cachedData[uid + ':' + groupName] = isMember;
		} else {
			Groups.cache.misses += 1;
		}
		return !isInCache;
	}

	Groups.isMemberOfAny = async function (uid, groups) {
		if (!groups.length) {
			return false;
		}
		const isMembers = await Groups.isMemberOfGroups(uid, groups);
		return isMembers.includes(true);
	};

	Groups.getMemberCount = async function (groupName) {
		const count = await db.getObjectField('group:' + groupName, 'memberCount');
		return parseInt(count, 10);
	};

	Groups.isMemberOfGroupList = async function (uid, groupListKey) {
		let groupNames = await db.getSortedSetRange('group:' + groupListKey + ':members', 0, -1);
		groupNames = Groups.removeEphemeralGroups(groupNames);
		if (!groupNames.length) {
			return false;
		}

		const isMembers = await Groups.isMemberOfGroups(uid, groupNames);
		return isMembers.includes(true);
	};

	Groups.isMemberOfGroupsList = async function (uid, groupListKeys) {
		const sets = groupListKeys.map(groupName => 'group:' + groupName + ':members');
		const members = await db.getSortedSetsMembers(sets);

		let uniqueGroups = _.uniq(_.flatten(members));
		uniqueGroups = Groups.removeEphemeralGroups(uniqueGroups);

		const isMembers = await Groups.isMemberOfGroups(uid, uniqueGroups);
		const isGroupMember = _.zipObject(uniqueGroups, isMembers);

		return members.map(function (groupNames) {
			return !!groupNames.find(name => isGroupMember[name]);
		});
	};

	Groups.isMembersOfGroupList = async function (uids, groupListKey) {
		const results = uids.map(() => false);

		let groupNames = await db.getSortedSetRange('group:' + groupListKey + ':members', 0, -1);
		groupNames = Groups.removeEphemeralGroups(groupNames);
		if (!groupNames.length) {
			return results;
		}
		const isGroupMembers = await Promise.all(groupNames.map(name => Groups.isMembers(uids, name)));

		isGroupMembers.forEach(function (isMembers) {
			results.forEach(function (isMember, index) {
				if (!isMember && isMembers[index]) {
					results[index] = true;
				}
			});
		});
		return results;
	};
};
