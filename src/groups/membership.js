'use strict';

const _ = require('lodash');

const db = require('../database');
const user = require('../user');
const cache = require('../cache');

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
		if (!uid || parseInt(uid, 10) <= 0 || !groupName) {
			return isMemberOfEphemeralGroup(uid, groupName);
		}

		const cacheKey = `${uid}:${groupName}`;
		let isMember = Groups.cache.get(cacheKey);
		if (isMember !== undefined) {
			return isMember;
		}
		isMember = await db.isSortedSetMember(`group:${groupName}:members`, uid);
		Groups.cache.set(cacheKey, isMember);
		return isMember;
	};

	Groups.isMembers = async function (uids, groupName) {
		if (!groupName || !uids.length) {
			return uids.map(() => false);
		}

		if (groupName === 'guests' || groupName === 'spiders') {
			return uids.map(uid => isMemberOfEphemeralGroup(uid, groupName));
		}

		const cachedData = {};
		const nonCachedUids = uids.filter(uid => filterNonCached(cachedData, uid, groupName));

		if (!nonCachedUids.length) {
			return uids.map(uid => cachedData[`${uid}:${groupName}`]);
		}

		const isMembers = await db.isSortedSetMembers(`group:${groupName}:members`, nonCachedUids);
		nonCachedUids.forEach((uid, index) => {
			cachedData[`${uid}:${groupName}`] = isMembers[index];
			Groups.cache.set(`${uid}:${groupName}`, isMembers[index]);
		});
		return uids.map(uid => cachedData[`${uid}:${groupName}`]);
	};

	Groups.isMemberOfGroups = async function (uid, groups) {
		if (!uid || parseInt(uid, 10) <= 0 || !groups.length) {
			return groups.map(groupName => isMemberOfEphemeralGroup(uid, groupName));
		}
		const cachedData = {};
		const nonCachedGroups = groups.filter(groupName => filterNonCached(cachedData, uid, groupName));

		if (!nonCachedGroups.length) {
			return groups.map(groupName => cachedData[`${uid}:${groupName}`]);
		}
		const nonCachedGroupsMemberSets = nonCachedGroups.map(groupName => `group:${groupName}:members`);
		const isMembers = await db.isMemberOfSortedSets(nonCachedGroupsMemberSets, uid);
		nonCachedGroups.forEach((groupName, index) => {
			cachedData[`${uid}:${groupName}`] = isMembers[index];
			Groups.cache.set(`${uid}:${groupName}`, isMembers[index]);
		});

		return groups.map(groupName => cachedData[`${uid}:${groupName}`]);
	};

	function isMemberOfEphemeralGroup(uid, groupName) {
		return (groupName === 'guests' && parseInt(uid, 10) === 0) ||
			(groupName === 'spiders' && parseInt(uid, 10) === -1);
	}

	function filterNonCached(cachedData, uid, groupName) {
		const isMember = Groups.cache.get(`${uid}:${groupName}`);
		const isInCache = isMember !== undefined;
		if (isInCache) {
			cachedData[`${uid}:${groupName}`] = isMember;
		}
		return !isInCache;
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

		const cachedData = {};
		const nonCachedKeys = keys.filter((groupName) => {
			const groupMembers = cache.get(`group:${groupName}:members`);
			const isInCache = groupMembers !== undefined;
			if (isInCache) {
				cachedData[groupName] = groupMembers;
			}
			return !isInCache;
		});

		if (!nonCachedKeys.length) {
			return isArray ? keys.map(groupName => cachedData[groupName]) : cachedData[keys[0]];
		}
		const groupMembers = await db.getSortedSetsMembers(nonCachedKeys.map(name => `group:${name}:members`));

		nonCachedKeys.forEach((groupName, index) => {
			cachedData[groupName] = groupMembers[index];
			cache.set(`group:${groupName}:members`, groupMembers[index]);
		});
		return isArray ? keys.map(groupName => cachedData[groupName]) : cachedData[keys[0]];
	}
};
