
'use strict';

const _ = require('lodash');
const validator = require('validator');

const groups = require('../groups');
const user = require('../user');
const categories = require('../categories');
const plugins = require('../plugins');
const translator = require('../translator');

const helpers = module.exports;

const uidToSystemGroup = {
	0: 'guests',
	'-1': 'spiders',
};

helpers.isUsersAllowedTo = async function (privilege, uids, cid) {
	const [hasUserPrivilege, hasGroupPrivilege] = await Promise.all([
		groups.isMembers(uids, `cid:${cid}:privileges:${privilege}`),
		groups.isMembersOfGroupList(uids, `cid:${cid}:privileges:groups:${privilege}`),
	]);
	const allowed = uids.map((uid, index) => hasUserPrivilege[index] || hasGroupPrivilege[index]);
	const result = await plugins.hooks.fire('filter:privileges:isUsersAllowedTo', { allowed: allowed, privilege: privilege, uids: uids, cid: cid });
	return result.allowed;
};

helpers.isAllowedTo = async function (privilege, uidOrGroupName, cid) {
	let allowed;
	if (Array.isArray(privilege) && !Array.isArray(cid)) {
		allowed = await isAllowedToPrivileges(privilege, uidOrGroupName, cid);
	} else if (Array.isArray(cid) && !Array.isArray(privilege)) {
		allowed = await isAllowedToCids(privilege, uidOrGroupName, cid);
	}
	if (allowed) {
		({ allowed } = await plugins.hooks.fire('filter:privileges:isAllowedTo', { allowed: allowed, privilege: privilege, uid: uidOrGroupName, cid: cid }));
		return allowed;
	}
	throw new Error('[[error:invalid-data]]');
};

async function isAllowedToCids(privilege, uidOrGroupName, cids) {
	if (!privilege) {
		return cids.map(() => false);
	}

	const groupKeys = cids.map(cid => `cid:${cid}:privileges:groups:${privilege}`);

	// Group handling
	if (isNaN(parseInt(uidOrGroupName, 10)) && (uidOrGroupName || '').length) {
		return await checkIfAllowedGroup(uidOrGroupName, groupKeys);
	}

	// User handling
	if (parseInt(uidOrGroupName, 10) <= 0) {
		return await isSystemGroupAllowedToCids(privilege, uidOrGroupName, cids);
	}

	const userKeys = cids.map(cid => `cid:${cid}:privileges:${privilege}`);
	return await checkIfAllowedUser(uidOrGroupName, userKeys, groupKeys);
}

async function isAllowedToPrivileges(privileges, uidOrGroupName, cid) {
	const groupKeys = privileges.map(privilege => `cid:${cid}:privileges:groups:${privilege}`);
	// Group handling
	if (isNaN(parseInt(uidOrGroupName, 10)) && (uidOrGroupName || '').length) {
		return await checkIfAllowedGroup(uidOrGroupName, groupKeys);
	}

	// User handling
	if (parseInt(uidOrGroupName, 10) <= 0) {
		return await isSystemGroupAllowedToPrivileges(privileges, uidOrGroupName, cid);
	}

	const userKeys = privileges.map(privilege => `cid:${cid}:privileges:${privilege}`);
	return await checkIfAllowedUser(uidOrGroupName, userKeys, groupKeys);
}

async function checkIfAllowedUser(uid, userKeys, groupKeys) {
	const [hasUserPrivilege, hasGroupPrivilege] = await Promise.all([
		groups.isMemberOfGroups(uid, userKeys),
		groups.isMemberOfGroupsList(uid, groupKeys),
	]);
	return userKeys.map((key, index) => hasUserPrivilege[index] || hasGroupPrivilege[index]);
}

async function checkIfAllowedGroup(groupName, groupKeys) {
	const sets = await Promise.all([
		groups.isMemberOfGroups(groupName, groupKeys),
		groups.isMemberOfGroups('registered-users', groupKeys),
	]);
	return groupKeys.map((key, index) => sets[0][index] || sets[1][index]);
}

async function isSystemGroupAllowedToCids(privilege, uid, cids) {
	const groupKeys = cids.map(cid => `cid:${cid}:privileges:groups:${privilege}`);
	return await groups.isMemberOfGroups(uidToSystemGroup[uid], groupKeys);
}

async function isSystemGroupAllowedToPrivileges(privileges, uid, cid) {
	const groupKeys = privileges.map(privilege => `cid:${cid}:privileges:groups:${privilege}`);
	return await groups.isMemberOfGroups(uidToSystemGroup[uid], groupKeys);
}

helpers.getUserPrivileges = async function (cid, userPrivileges) {
	let memberSets = await groups.getMembersOfGroups(userPrivileges.map(privilege => `cid:${cid}:privileges:${privilege}`));
	memberSets = memberSets.map(set => set.map(uid => parseInt(uid, 10)));

	const members = _.uniq(_.flatten(memberSets));
	const memberData = await user.getUsersFields(members, ['picture', 'username', 'banned']);

	memberData.forEach((member) => {
		member.privileges = {};
		for (let x = 0, numPrivs = userPrivileges.length; x < numPrivs; x += 1) {
			member.privileges[userPrivileges[x]] = memberSets[x].includes(parseInt(member.uid, 10));
		}
		const types = {};
		for (const [key] of Object.entries(member.privileges)) {
			types[key] = getType(key);
		}
		member.types = types;
	});

	return memberData;
};

helpers.getGroupPrivileges = async function (cid, groupPrivileges) {
	const [memberSets, allGroupNames] = await Promise.all([
		groups.getMembersOfGroups(groupPrivileges.map(privilege => `cid:${cid}:privileges:${privilege}`)),
		groups.getGroups('groups:createtime', 0, -1),
	]);

	const uniqueGroups = _.uniq(_.flatten(memberSets));

	let groupNames = allGroupNames.filter(groupName => !groupName.includes(':privileges:') && uniqueGroups.includes(groupName));

	groupNames = groups.ephemeralGroups.concat(groupNames);
	moveToFront(groupNames, groups.BANNED_USERS);
	moveToFront(groupNames, 'Global Moderators');
	moveToFront(groupNames, 'unverified-users');
	moveToFront(groupNames, 'verified-users');
	moveToFront(groupNames, 'registered-users');

	const adminIndex = groupNames.indexOf('administrators');
	if (adminIndex !== -1) {
		groupNames.splice(adminIndex, 1);
	}
	const groupData = await groups.getGroupsFields(groupNames, ['private', 'system']);
	const memberData = groupNames.map((member, index) => {
		const memberPrivs = {};

		for (let x = 0, numPrivs = groupPrivileges.length; x < numPrivs; x += 1) {
			memberPrivs[groupPrivileges[x]] = memberSets[x].includes(member);
		}
		const types = {};
		for (const [key] of Object.entries(memberPrivs)) {
			types[key] = getType(key);
		}
		return {
			name: validator.escape(member),
			nameEscaped: translator.escape(validator.escape(member)),
			privileges: memberPrivs,
			types: types,
			isPrivate: groupData[index] && !!groupData[index].private,
			isSystem: groupData[index] && !!groupData[index].system,
		};
	});
	return memberData;
};


function getType(privilege) {
	privilege = privilege.replace(/^groups:/, '');
	const global = require('./global');
	const categories = require('./categories');
	return global.getType(privilege) || categories.getType(privilege) || 'other';
}

function moveToFront(groupNames, groupToMove) {
	const index = groupNames.indexOf(groupToMove);
	if (index !== -1) {
		groupNames.splice(0, 0, groupNames.splice(index, 1)[0]);
	} else {
		groupNames.unshift(groupToMove);
	}
}

helpers.giveOrRescind = async function (method, privileges, cids, members) {
	members = Array.isArray(members) ? members : [members];
	cids = Array.isArray(cids) ? cids : [cids];
	for (const member of members) {
		const groupKeys = [];
		cids.forEach((cid) => {
			privileges.forEach((privilege) => {
				groupKeys.push(`cid:${cid}:privileges:${privilege}`);
			});
		});
		/* eslint-disable no-await-in-loop */
		await method(groupKeys, member);
	}
};

helpers.userOrGroupPrivileges = async function (cid, uidOrGroup, privilegeList) {
	const groupNames = privilegeList.map(privilege => `cid:${cid}:privileges:${privilege}`);
	const isMembers = await groups.isMemberOfGroups(uidOrGroup, groupNames);
	return _.zipObject(privilegeList, isMembers);
};

helpers.getUidsWithPrivilege = async (cids, privilege) => {
	const disabled = (await categories.getCategoriesFields(cids, ['disabled'])).map(obj => obj.disabled);

	const groupNames = cids.reduce((memo, cid) => {
		memo.push(`cid:${cid}:privileges:${privilege}`);
		memo.push(`cid:${cid}:privileges:groups:${privilege}`);
		return memo;
	}, []);

	const memberSets = await groups.getMembersOfGroups(groupNames);
	// Every other set is actually a list of user groups, not uids, so convert those to members
	const sets = memberSets.reduce((memo, set, idx) => {
		if (idx % 2) {
			memo.groupNames.push(set);
		} else {
			memo.uids.push(set);
		}

		return memo;
	}, { groupNames: [], uids: [] });

	const uniqGroups = _.uniq(_.flatten(sets.groupNames));
	const groupUids = await groups.getMembersOfGroups(uniqGroups);
	const map = _.zipObject(uniqGroups, groupUids);
	const uidsByCid = cids.map((cid, index) => {
		if (disabled[index]) {
			return [];
		}

		return _.uniq(sets.uids[index].concat(_.flatten(sets.groupNames[index].map(g => map[g]))));
	});
	return uidsByCid;
};

require('../promisify')(helpers);
