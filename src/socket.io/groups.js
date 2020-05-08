'use strict';

const validator = require('validator');
const groups = require('../groups');
const meta = require('../meta');
const user = require('../user');
const utils = require('../utils');
const events = require('../events');
const privileges = require('../privileges');
const notifications = require('../notifications');

const SocketGroups = module.exports;

SocketGroups.before = async (socket, method, data) => {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
};

SocketGroups.join = async (socket, data) => {
	if (socket.uid <= 0) {
		throw new Error('[[error:invalid-uid]]');
	}

	if (typeof data.groupName !== 'string') {
		throw new Error('[[error:invalid-group-name]]');
	}

	if (data.groupName === 'administrators' || groups.isPrivilegeGroup(data.groupName)) {
		throw new Error('[[error:not-allowed]]');
	}

	const exists = await groups.exists(data.groupName);
	if (!exists) {
		throw new Error('[[error:no-group]]');
	}

	if (!meta.config.allowPrivateGroups) {
		await groups.join(data.groupName, socket.uid);
		logGroupEvent(socket, 'group-join', {
			groupName: data.groupName,
		});
		return;
	}

	const results = await utils.promiseParallel({
		isAdmin: await user.isAdministrator(socket.uid),
		groupData: await groups.getGroupData(data.groupName),
	});

	if (results.groupData.private && results.groupData.disableJoinRequests) {
		throw new Error('[[error:group-join-disabled]]');
	}

	if (!results.groupData.private || results.isAdmin) {
		await groups.join(data.groupName, socket.uid);
		logGroupEvent(socket, 'group-join', {
			groupName: data.groupName,
		});
	} else {
		await groups.requestMembership(data.groupName, socket.uid);
		logGroupEvent(socket, 'group-request-membership', {
			groupName: data.groupName,
		});
	}
};

SocketGroups.leave = async (socket, data) => {
	if (socket.uid <= 0) {
		throw new Error('[[error:invalid-uid]]');
	}

	if (typeof data.groupName !== 'string') {
		throw new Error('[[error:invalid-group-name]]');
	}

	if (data.groupName === 'administrators') {
		throw new Error('[[error:cant-remove-self-as-admin]]');
	}

	const groupData = await groups.getGroupData(data.groupName);
	if (groupData.disableLeave) {
		throw new Error('[[error:group-leave-disabled]]');
	}

	await groups.leave(data.groupName, socket.uid);
	const username = await user.getUserField(socket.uid, 'username');
	const notification = await notifications.create({
		type: 'group-leave',
		bodyShort: '[[groups:membership.leave.notification_title, ' + username + ', ' + data.groupName + ']]',
		nid: 'group:' + validator.escape(data.groupName) + ':uid:' + socket.uid + ':group-leave',
		path: '/groups/' + utils.slugify(data.groupName),
	});
	const uids = await groups.getOwners(data.groupName);
	await notifications.push(notification, uids);

	logGroupEvent(socket, 'group-leave', {
		groupName: data.groupName,
	});
};

SocketGroups.addMember = async (socket, data) => {
	await isOwner(socket, data);
	if (data.groupName === 'administrators' || groups.isPrivilegeGroup(data.groupName)) {
		throw new Error('[[error:not-allowed]]');
	}
	await groups.join(data.groupName, data.uid);
	logGroupEvent(socket, 'group-add-member', {
		groupName: data.groupName,
		targetUid: data.uid,
	});
};

async function isOwner(socket, data) {
	if (typeof data.groupName !== 'string') {
		throw new Error('[[error:invalid-group-name]]');
	}
	const results = await utils.promiseParallel({
		isAdmin: await user.isAdministrator(socket.uid),
		isGlobalModerator: await user.isGlobalModerator(socket.uid),
		isOwner: await groups.ownership.isOwner(socket.uid, data.groupName),
		group: await groups.getGroupData(data.groupName),
	});

	var isOwner = results.isOwner || results.isAdmin || (results.isGlobalModerator && !results.group.system);
	if (!isOwner) {
		throw new Error('[[error:no-privileges]]');
	}
}

async function isInvited(socket, data) {
	if (typeof data.groupName !== 'string') {
		throw new Error('[[error:invalid-group-name]]');
	}
	const invited = await groups.isInvited(socket.uid, data.groupName);
	if (!invited) {
		throw new Error('[[error:not-invited]]');
	}
}

SocketGroups.grant = async (socket, data) => {
	await isOwner(socket, data);
	await groups.ownership.grant(data.toUid, data.groupName);
	logGroupEvent(socket, 'group-owner-grant', {
		groupName: data.groupName,
		targetUid: data.toUid,
	});
};

SocketGroups.rescind = async (socket, data) => {
	await isOwner(socket, data);
	await groups.ownership.rescind(data.toUid, data.groupName);
	logGroupEvent(socket, 'group-owner-rescind', {
		groupName: data.groupName,
		targetUid: data.toUid,
	});
};

SocketGroups.accept = async (socket, data) => {
	await isOwner(socket, data);
	await groups.acceptMembership(data.groupName, data.toUid);
	logGroupEvent(socket, 'group-accept-membership', {
		groupName: data.groupName,
		targetUid: data.toUid,
	});
};

SocketGroups.reject = async (socket, data) => {
	await isOwner(socket, data);
	await groups.rejectMembership(data.groupName, data.toUid);
	logGroupEvent(socket, 'group-reject-membership', {
		groupName: data.groupName,
		targetUid: data.toUid,
	});
};

SocketGroups.acceptAll = async (socket, data) => {
	await isOwner(socket, data);
	await acceptRejectAll(SocketGroups.accept, socket, data);
};

SocketGroups.rejectAll = async (socket, data) => {
	await isOwner(socket, data);
	await acceptRejectAll(SocketGroups.reject, socket, data);
};

async function acceptRejectAll(method, socket, data) {
	if (typeof data.groupName !== 'string') {
		throw new Error('[[error:invalid-group-name]]');
	}
	const uids = await groups.getPending(data.groupName);
	await Promise.all(uids.map(async (uid) => {
		await method(socket, { groupName: data.groupName, toUid: uid });
	}));
}

SocketGroups.issueInvite = async (socket, data) => {
	await isOwner(socket, data);
	await groups.invite(data.groupName, data.toUid);
	logGroupEvent(socket, 'group-invite', {
		groupName: data.groupName,
		targetUid: data.toUid,
	});
};

SocketGroups.issueMassInvite = async (socket, data) => {
	await isOwner(socket, data);
	if (!data || !data.usernames || !data.groupName) {
		throw new Error('[[error:invalid-data]]');
	}
	let usernames = String(data.usernames).split(',');
	usernames = usernames.map(username => username && username.trim());

	let uids = await user.getUidsByUsernames(usernames);
	uids = uids.filter(uid => !!uid && parseInt(uid, 10));

	await groups.invite(data.groupName, uids);

	for (const uid of uids) {
		logGroupEvent(socket, 'group-invite', {
			groupName: data.groupName,
			targetUid: uid,
		});
	}
};

SocketGroups.rescindInvite = async (socket, data) => {
	await isOwner(socket, data);
	await groups.rejectMembership(data.groupName, data.toUid);
};

SocketGroups.acceptInvite = async (socket, data) => {
	await isInvited(socket, data);
	await groups.acceptMembership(data.groupName, socket.uid);
	logGroupEvent(socket, 'group-invite-accept', {
		groupName: data.groupName,
	});
};

SocketGroups.rejectInvite = async (socket, data) => {
	await isInvited(socket, data);
	await groups.rejectMembership(data.groupName, socket.uid);
	logGroupEvent(socket, 'group-invite-reject', {
		groupName: data.groupName,
	});
};

SocketGroups.update = async (socket, data) => {
	await isOwner(socket, data);
	await groups.update(data.groupName, data.values);
};


SocketGroups.kick = async (socket, data) => {
	await isOwner(socket, data);
	if (socket.uid === parseInt(data.uid, 10)) {
		throw new Error('[[error:cant-kick-self]]');
	}

	const isOwnerBit = await groups.ownership.isOwner(data.uid, data.groupName);
	await groups.kick(data.uid, data.groupName, isOwnerBit);
	logGroupEvent(socket, 'group-kick', {
		groupName: data.groupName,
		targetUid: data.uid,
	});
};

SocketGroups.create = async (socket, data) => {
	if (!socket.uid) {
		throw new Error('[[error:no-privileges]]');
	} else if (typeof data.name !== 'string' || groups.isPrivilegeGroup(data.name)) {
		throw new Error('[[error:invalid-group-name]]');
	}

	const canCreate = await privileges.global.can('group:create', socket.uid);
	if (!canCreate) {
		throw new Error('[[error:no-privileges]]');
	}
	data.ownerUid = socket.uid;
	data.system = false;
	const groupData = await groups.create(data);
	logGroupEvent(socket, 'group-create', {
		groupName: data.name,
	});

	return groupData;
};

SocketGroups.delete = async (socket, data) => {
	await isOwner(socket, data);
	if (
		data.groupName === 'administrators' || data.groupName === 'registered-users' ||
		data.groupName === 'guests' || data.groupName === 'Global Moderators'
	) {
		throw new Error('[[error:not-allowed]]');
	}

	await groups.destroy(data.groupName);
	logGroupEvent(socket, 'group-delete', {
		groupName: data.groupName,
	});
};

SocketGroups.search = async (socket, data) => {
	data.options = data.options || {};

	if (!data.query) {
		const groupsPerPage = 15;
		const groupData = await groups.getGroupsBySort(data.options.sort, 0, groupsPerPage - 1);
		return groupData;
	}
	data.options.filterHidden = data.options.filterHidden || !await user.isAdministrator(socket.uid);
	return await groups.search(data.query, data.options);
};

SocketGroups.loadMore = async (socket, data) => {
	if (!data.sort || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
		throw new Error('[[error:invalid-data]]');
	}

	const groupsPerPage = 10;
	const start = parseInt(data.after, 10);
	const stop = start + groupsPerPage - 1;
	const groupData = await groups.getGroupsBySort(data.sort, start, stop);
	return { groups: groupData, nextStart: stop + 1 };
};

SocketGroups.searchMembers = async (socket, data) => {
	data.uid = socket.uid;
	const [isOwner, isMember, isAdmin] = await Promise.all([
		groups.ownership.isOwner(socket.uid, data.groupName),
		groups.isMember(socket.uid, data.groupName),
		user.isAdministrator(socket.uid),
	]);
	if (!isOwner && !isMember && !isAdmin) {
		throw new Error('[[error:no-privileges]]');
	}
	return await groups.searchMembers(data);
};

SocketGroups.loadMoreMembers = async (socket, data) => {
	if (!data.groupName || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
		throw new Error('[[error:invalid-data]]');
	}
	const [isHidden, isAdmin, isGlobalMod] = await Promise.all([
		groups.isHidden(data.groupName),
		user.isAdministrator(socket.uid),
		user.isGlobalModerator(socket.uid),
	]);
	if (isHidden && !isAdmin && !isGlobalMod) {
		const isMember = await groups.isMember(socket.uid, data.groupName);
		if (!isMember) {
			throw new Error('[[error:no-privileges]]');
		}
	}

	data.after = parseInt(data.after, 10);
	const users = await groups.getOwnersAndMembers(data.groupName, socket.uid, data.after, data.after + 9);
	return {
		users: users,
		nextStart: data.after + 10,
	};
};

SocketGroups.cover = {};

SocketGroups.cover.update = async (socket, data) => {
	if (!socket.uid) {
		throw new Error('[[error:no-privileges]]');
	}
	await canModifyGroup(socket.uid, data.groupName);
	return await groups.updateCover(socket.uid, data);
};

SocketGroups.cover.remove = async (socket, data) => {
	if (!socket.uid) {
		throw new Error('[[error:no-privileges]]');
	}

	await canModifyGroup(socket.uid, data.groupName);
	await groups.removeCover(data);
};

async function canModifyGroup(uid, groupName) {
	if (typeof groupName !== 'string') {
		throw new Error('[[error:invalid-group-name]]');
	}
	const results = await utils.promiseParallel({
		isOwner: groups.ownership.isOwner(uid, groupName),
		system: groups.getGroupField(groupName, 'system'),
		isAdmin: user.isAdministrator(uid),
		isGlobalMod: user.isGlobalModerator(uid),
	});

	if (!(results.isOwner || results.isAdmin || (results.isGlobalMod && !results.system))) {
		throw new Error('[[error:no-privileges]]');
	}
}

function logGroupEvent(socket, event, additional) {
	events.log({
		type: event,
		uid: socket.uid,
		ip: socket.ip,
		...additional,
	});
}

require('../promisify')(SocketGroups);
