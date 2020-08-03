
'use strict';

const _ = require('lodash');
const validator = require('validator');

const groups = require('../groups');
const user = require('../user');
const plugins = require('../plugins');
const translator = require('../translator');

const helpers = module.exports;

const uidToSystemGroup = {
	0: 'guests',
	'-1': 'spiders',
};

helpers.isUsersAllowedTo = async function (privilege, uids, cid) {
	const [hasUserPrivilege, hasGroupPrivilege] = await Promise.all([
		groups.isMembers(uids, 'cid:' + cid + ':privileges:' + privilege),
		groups.isMembersOfGroupList(uids, 'cid:' + cid + ':privileges:groups:' + privilege),
	]);
	const allowed = uids.map((uid, index) => hasUserPrivilege[index] || hasGroupPrivilege[index]);
	const result = await plugins.fireHook('filter:privileges:isUsersAllowedTo', { allowed: allowed, privilege: privilege, uids: uids, cid: cid });
	return result.allowed;
};

helpers.isUserAllowedTo = async function (privilege, uid, cid) {
	let allowed;
	if (Array.isArray(privilege) && !Array.isArray(cid)) {
		allowed = await isUserAllowedToPrivileges(privilege, uid, cid);
	} else if (Array.isArray(cid) && !Array.isArray(privilege)) {
		allowed = await isUserAllowedToCids(privilege, uid, cid);
	}
	if (allowed) {
		const result = await plugins.fireHook('filter:privileges:isUserAllowedTo', { allowed: allowed, privilege: privilege, uid: uid, cid: cid });
		return result.allowed;
	}
	throw new Error('[[error:invalid-data]]');
};

async function isUserAllowedToCids(privilege, uid, cids) {
	if (parseInt(uid, 10) <= 0) {
		return await isSystemGroupAllowedToCids(privilege, uid, cids);
	}

	const userKeys = [];
	const groupKeys = [];
	cids.forEach(function (cid) {
		userKeys.push('cid:' + cid + ':privileges:' + privilege);
		groupKeys.push('cid:' + cid + ':privileges:groups:' + privilege);
	});

	return await checkIfAllowed(uid, userKeys, groupKeys);
}

async function isUserAllowedToPrivileges(privileges, uid, cid) {
	if (parseInt(uid, 10) <= 0) {
		return await isSystemGroupAllowedToPrivileges(privileges, uid, cid);
	}

	const userKeys = [];
	const groupKeys = [];
	privileges.forEach(function (privilege) {
		userKeys.push('cid:' + cid + ':privileges:' + privilege);
		groupKeys.push('cid:' + cid + ':privileges:groups:' + privilege);
	});

	return await checkIfAllowed(uid, userKeys, groupKeys);
}

async function checkIfAllowed(uid, userKeys, groupKeys) {
	const [hasUserPrivilege, hasGroupPrivilege] = await Promise.all([
		groups.isMemberOfGroups(uid, userKeys),
		groups.isMemberOfGroupsList(uid, groupKeys),
	]);
	return userKeys.map((key, index) => hasUserPrivilege[index] || hasGroupPrivilege[index]);
}

async function isSystemGroupAllowedToCids(privilege, uid, cids) {
	const groupKeys = cids.map(cid => 'cid:' + cid + ':privileges:groups:' + privilege);
	return await groups.isMemberOfGroups(uidToSystemGroup[uid], groupKeys);
}

async function isSystemGroupAllowedToPrivileges(privileges, uid, cid) {
	const groupKeys = privileges.map(privilege => 'cid:' + cid + ':privileges:groups:' + privilege);
	return await groups.isMemberOfGroups(uidToSystemGroup[uid], groupKeys);
}

helpers.getUserPrivileges = async function (cid, userPrivileges) {
	let memberSets = await groups.getMembersOfGroups(userPrivileges.map(privilege => 'cid:' + cid + ':privileges:' + privilege));
	memberSets = memberSets.map(function (set) {
		return set.map(uid => parseInt(uid, 10));
	});

	const members = _.uniq(_.flatten(memberSets));
	const memberData = await user.getUsersFields(members, ['picture', 'username']);

	memberData.forEach(function (member) {
		member.privileges = {};
		for (var x = 0, numPrivs = userPrivileges.length; x < numPrivs; x += 1) {
			member.privileges[userPrivileges[x]] = memberSets[x].includes(parseInt(member.uid, 10));
		}
	});

	return memberData;
};

helpers.getGroupPrivileges = async function (cid, groupPrivileges) {
	const [memberSets, allGroupNames] = await Promise.all([
		groups.getMembersOfGroups(groupPrivileges.map(privilege => 'cid:' + cid + ':privileges:' + privilege)),
		groups.getGroups('groups:createtime', 0, -1),
	]);

	const uniqueGroups = _.uniq(_.flatten(memberSets));

	let groupNames = allGroupNames.filter(groupName => !groupName.includes(':privileges:') && uniqueGroups.includes(groupName));

	groupNames = groups.ephemeralGroups.concat(groupNames);
	moveToFront(groupNames, 'Global Moderators');
	moveToFront(groupNames, 'registered-users');

	const adminIndex = groupNames.indexOf('administrators');
	if (adminIndex !== -1) {
		groupNames.splice(adminIndex, 1);
	}
	const groupData = await groups.getGroupsFields(groupNames, ['private']);
	const memberData = groupNames.map(function (member, index) {
		const memberPrivs = {};

		for (var x = 0, numPrivs = groupPrivileges.length; x < numPrivs; x += 1) {
			memberPrivs[groupPrivileges[x]] = memberSets[x].includes(member);
		}
		return {
			name: validator.escape(member),
			nameEscaped: translator.escape(validator.escape(member)),
			privileges: memberPrivs,
			isPrivate: groupData[index] && !!groupData[index].private,
		};
	});
	return memberData;
};

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
				groupKeys.push('cid:' + cid + ':privileges:' + privilege);
			});
		});
		/* eslint-disable no-await-in-loop */
		await method(groupKeys, member);
	}
};

require('../promisify')(helpers);
