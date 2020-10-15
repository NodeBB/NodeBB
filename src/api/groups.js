'use strict';

const privileges = require('../privileges');
const events = require('../events');
const groups = require('../groups');
const user = require('../user');
const meta = require('../meta');

const groupsAPI = module.exports;

groupsAPI.create = async function (caller, data) {
	if (!caller.uid) {
		throw new Error('[[error:no-privileges]]');
	} else if (typeof data.name !== 'string' || groups.isPrivilegeGroup(data.name)) {
		throw new Error('[[error:invalid-group-name]]');
	}

	const canCreate = await privileges.global.can('group:create', caller.uid);
	if (!canCreate) {
		throw new Error('[[error:no-privileges]]');
	}
	data.ownerUid = caller.uid;
	data.system = false;
	const groupData = await groups.create(data);
	logGroupEvent(caller, 'group-create', {
		groupName: data.name,
	});

	return groupData;
};

groupsAPI.join = async function (caller, data) {
	if (caller.uid <= 0 || !data.uid) {
		throw new Error('[[error:invalid-uid]]');
	}

	const isSelf = parseInt(caller.uid, 10) === parseInt(data.uid, 10);
	const groupName = await groups.getGroupNameByGroupSlug(data.slug);
	if (!groupName) {
		throw new Error('[[error:no-group]]');
	}

	if (groups.systemGroups.includes(groupName) || groups.isPrivilegeGroup(groupName)) {
		throw new Error('[[error:not-allowed]]');
	}

	const [groupData, isCallerAdmin, isCallerOwner, userExists] = await Promise.all([
		groups.getGroupData(groupName),
		user.isAdministrator(caller.uid),
		groups.ownership.isOwner(caller.uid, groupName),
		user.exists(data.uid),
	]);

	if (!userExists) {
		throw new Error('[[error:invalid-uid]]');
	}

	if (!meta.config.allowPrivateGroups && isSelf) {
		// all groups are public!
		await groups.join(groupName, data.uid);
		logGroupEvent(caller, 'group-join', {
			groupName: groupName,
			targetUid: data.uid,
		});
		return;
	}

	if (groupData.private && groupData.disableJoinRequests) {
		throw new Error('[[error:group-join-disabled]]');
	}

	if ((!groupData.private && isSelf) || isCallerAdmin || isCallerOwner) {
		await groups.join(groupName, data.uid);
		logGroupEvent(caller, 'group-join', {
			groupName: groupName,
			targetUid: data.uid,
		});
	} else if (isSelf) {
		await groups.requestMembership(groupName, caller.uid);
		logGroupEvent(caller, 'group-request-membership', {
			groupName: groupName,
			targetUid: data.uid,
		});
	}
};

// groupsAPI.leave = async function (caller, data) {
// 	// TODO:
// };

// groupsAPI.delete = async function (caller, data) {
// 	// TODO:
// };

function logGroupEvent(caller, event, additional) {
	events.log({
		type: event,
		uid: caller.uid,
		ip: caller.ip,
		...additional,
	});
}
