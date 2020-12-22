'use strict';

const validator = require('validator');

const privileges = require('../privileges');
const events = require('../events');
const groups = require('../groups');
const user = require('../user');
const meta = require('../meta');
const notifications = require('../notifications');
const slugify = require('../slugify');

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

groupsAPI.update = async function (caller, data) {
	const groupName = await groups.getGroupNameByGroupSlug(data.slug);
	await isOwner(caller, groupName);

	delete data.slug;
	await groups.update(groupName, data);

	return await groups.getGroupData(data.name || groupName);
};

groupsAPI.delete = async function (caller, data) {
	const groupName = await groups.getGroupNameByGroupSlug(data.slug);
	await isOwner(caller, groupName);
	if (
		groups.systemGroups.includes(groupName) ||
		groups.ephemeralGroups.includes(groupName)
	) {
		throw new Error('[[error:not-allowed]]');
	}

	await groups.destroy(groupName);
	logGroupEvent(caller, 'group-delete', {
		groupName: groupName,
	});
};

groupsAPI.join = async function (caller, data) {
	if (caller.uid <= 0 || !data.uid) {
		throw new Error('[[error:invalid-uid]]');
	}

	const groupName = await groups.getGroupNameByGroupSlug(data.slug);
	if (!groupName) {
		throw new Error('[[error:no-group]]');
	}

	const isCallerAdmin = await user.isAdministrator(caller.uid);
	if (!isCallerAdmin && (
		groups.systemGroups.includes(groupName) ||
		groups.isPrivilegeGroup(groupName)
	)) {
		throw new Error('[[error:not-allowed]]');
	}

	const [groupData, isCallerOwner, userExists] = await Promise.all([
		groups.getGroupData(groupName),
		groups.ownership.isOwner(caller.uid, groupName),
		user.exists(data.uid),
	]);

	if (!userExists) {
		throw new Error('[[error:invalid-uid]]');
	}

	const isSelf = parseInt(caller.uid, 10) === parseInt(data.uid, 10);
	if (!meta.config.allowPrivateGroups && isSelf) {
		// all groups are public!
		await groups.join(groupName, data.uid);
		logGroupEvent(caller, 'group-join', {
			groupName: groupName,
			targetUid: data.uid,
		});
		return;
	}

	if (isSelf && groupData.private && groupData.disableJoinRequests) {
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

groupsAPI.leave = async function (caller, data) {
	if (caller.uid <= 0) {
		throw new Error('[[error:invalid-uid]]');
	}
	const isSelf = parseInt(caller.uid, 10) === parseInt(data.uid, 10);
	const groupName = await groups.getGroupNameByGroupSlug(data.slug);
	if (!groupName) {
		throw new Error('[[error:no-group]]');
	}

	if (typeof groupName !== 'string') {
		throw new Error('[[error:invalid-group-name]]');
	}

	if (groupName === 'administrators' && isSelf) {
		throw new Error('[[error:cant-remove-self-as-admin]]');
	}

	const [groupData, isCallerAdmin, isCallerOwner, userExists, isMember] = await Promise.all([
		groups.getGroupData(groupName),
		user.isAdministrator(caller.uid),
		groups.ownership.isOwner(caller.uid, groupName),
		user.exists(data.uid),
		groups.isMember(data.uid, groupName),
	]);

	if (!userExists) {
		throw new Error('[[error:invalid-uid]]');
	}
	if (!isMember) {
		return;
	}

	if (groupData.disableLeave && isSelf) {
		throw new Error('[[error:group-leave-disabled]]');
	}

	if (isSelf || isCallerAdmin || isCallerOwner) {
		await groups.leave(groupName, data.uid);
	} else {
		throw new Error('[[error:no-privileges]]');
	}

	const username = await user.getUserField(data.uid, 'username');
	const notification = await notifications.create({
		type: 'group-leave',
		bodyShort: '[[groups:membership.leave.notification_title, ' + username + ', ' + groupName + ']]',
		nid: 'group:' + validator.escape(groupName) + ':uid:' + data.uid + ':group-leave',
		path: '/groups/' + slugify(groupName),
		from: data.uid,
	});
	const uids = await groups.getOwners(groupName);
	await notifications.push(notification, uids);

	logGroupEvent(caller, 'group-leave', {
		groupName: groupName,
		targetUid: data.uid,
	});
};

groupsAPI.grant = async (caller, data) => {
	const groupName = await groups.getGroupNameByGroupSlug(data.slug);
	await isOwner(caller, groupName);

	await groups.ownership.grant(data.uid, groupName);
	logGroupEvent(caller, 'group-owner-grant', {
		groupName: groupName,
		targetUid: data.uid,
	});
};

groupsAPI.rescind = async (caller, data) => {
	const groupName = await groups.getGroupNameByGroupSlug(data.slug);
	await isOwner(caller, groupName);

	await groups.ownership.rescind(data.uid, groupName);
	logGroupEvent(caller, 'group-owner-rescind', {
		groupName: groupName,
		targetUid: data.uid,
	});
};

async function isOwner(caller, groupName) {
	if (typeof groupName !== 'string') {
		throw new Error('[[error:invalid-group-name]]');
	}
	const [isAdmin, isGlobalModerator, isOwner, group] = await Promise.all([
		user.isAdministrator(caller.uid),
		user.isGlobalModerator(caller.uid),
		groups.ownership.isOwner(caller.uid, groupName),
		groups.getGroupData(groupName),
	]);

	const check = isOwner || isAdmin || (isGlobalModerator && !group.system);
	if (!check) {
		throw new Error('[[error:no-privileges]]');
	}
}

function logGroupEvent(caller, event, additional) {
	events.log({
		type: event,
		uid: caller.uid,
		ip: caller.ip,
		...additional,
	});
}
