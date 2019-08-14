'use strict';

var groups = require('../groups');
var meta = require('../meta');
var user = require('../user');
var utils = require('../utils');
var groupsController = require('../controllers/groups');
var events = require('../events');
var privileges = require('../privileges');

var SocketGroups = module.exports;

SocketGroups.before = async (socket, method, data) => {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
};

SocketGroups.join = async (socket, data) => {
	if (socket.uid <= 0) {
		throw new Error('[[error:invalid-uid]]');
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
		return;
	}

	const results = await utils.promiseParallel({
		isAdmin: await user.isAdministrator(socket.uid),
		groupData: await groups.getGroupData(data.groupName),
	});

	if (results.groupData.private && results.groupData.disableJoinRequests) {
		throw new Error('[[error:join-requests-disabled]]');
	}

	if (!results.groupData.private || results.isAdmin) {
		await groups.join(data.groupName, socket.uid);
	} else {
		await groups.requestMembership(data.groupName, socket.uid);
	}
};

SocketGroups.leave = async (socket, data) => {
	if (socket.uid <= 0) {
		throw new Error('[[error:invalid-uid]]');
	}

	if (data.groupName === 'administrators') {
		throw new Error('[[error:cant-remove-self-as-admin]]');
	}

	await groups.leave(data.groupName, socket.uid);
};

SocketGroups.addMember = async (socket, data) => {
	await isOwner(socket, data);
	if (data.groupName === 'administrators' || groups.isPrivilegeGroup(data.groupName)) {
		throw new Error('[[error:not-allowed]]');
	}
	await groups.join(data.groupName, data.uid);
};

async function isOwner(socket, data) {
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
	const invited = await groups.isInvited(socket.uid, data.groupName);
	if (!invited) {
		throw new Error('[[error:not-invited]]');
	}
}

SocketGroups.grant = async (socket, data) => {
	await isOwner(socket, data);
	await groups.ownership.grant(data.toUid, data.groupName);
};

SocketGroups.rescind = async (socket, data) => {
	await isOwner(socket, data);
	await groups.ownership.rescind(data.toUid, data.groupName);
};

SocketGroups.accept = async (socket, data) => {
	await isOwner(socket, data);
	await groups.acceptMembership(data.groupName, data.toUid);
	events.log({
		type: 'accept-membership',
		uid: socket.uid,
		ip: socket.ip,
		groupName: data.groupName,
		targetUid: data.toUid,
	});
};

SocketGroups.reject = async (socket, data) => {
	await isOwner(socket, data);
	await groups.rejectMembership(data.groupName, data.toUid);
	events.log({
		type: 'reject-membership',
		uid: socket.uid,
		ip: socket.ip,
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
	const uids = groups.getPending(data.groupName);
	await new Promise(uids.forEach(async (uid) => {
		await method(socket, { groupName: data.groupName, toUid: uid });
	}));
}

SocketGroups.issueInvite = async (socket, data) => {
	await isOwner(socket, data);
	await groups.invite(data.groupName, data.toUid);
};

SocketGroups.issueMassInvite = async (socket, data) => {
	await isOwner(socket, data);
	if (!data || !data.usernames || !data.groupName) {
		throw new Error('[[error:invalid-data]]');
	}
	var usernames = String(data.usernames).split(',');
	usernames = usernames.map(function (username) {
		return username && username.trim();
	});

	let uids = await user.getUidsByUsernames(usernames);
	uids = uids.filter(function (uid) {
		return !!uid && parseInt(uid, 10);
	});

	// eslint-disable-next-line guard-for-in
	for (const i in uids) {
		// eslint-disable-next-line no-await-in-loop
		await groups.invite(data.groupName, uids[i]);
	}
};

SocketGroups.rescindInvite = async (socket, data) => {
	await isOwner(socket, data);
	await groups.rejectMembership(data.groupName, data.toUid);
};

SocketGroups.acceptInvite = async (socket, data) => {
	await isInvited(socket, data);
	await groups.acceptMembership(data.groupName, socket.uid);
};

SocketGroups.rejectInvite = async (socket, data) => {
	await isInvited(socket, data);
	await groups.rejectMembership(data.groupName, socket.uid);
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
};

SocketGroups.create = async (socket, data) => {
	if (!socket.uid) {
		throw new Error('[[error:no-privileges]]');
	} else if (groups.isPrivilegeGroup(data.name)) {
		throw new Error('[[error:invalid-group-name]]');
	}

	const canCreate = await privileges.global.can('group:create', socket.uid);
	if (!canCreate) {
		throw new Error('[[error:no-privileges]]');
	}
	data.ownerUid = socket.uid;
	await groups.create(data);
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
};

SocketGroups.search = async (socket, data) => {
	data.options = data.options || {};

	if (!data.query) {
		var groupsPerPage = 15;
		const groups = await groupsController.getGroupsFromSet(socket.uid, data.options.sort, 0, groupsPerPage - 1);
		return groups.groups;
	}

	await groups.search(data.query, data.options);
};

SocketGroups.loadMore = async (socket, data) => {
	if (!data.sort || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
		throw new Error('[[error:invalid-data]]');
	}

	var groupsPerPage = 9;
	var start = parseInt(data.after, 10);
	var stop = start + groupsPerPage - 1;
	await groupsController.getGroupsFromSet(socket.uid, data.sort, start, stop);
};

SocketGroups.searchMembers = async (socket, data) => {
	data.uid = socket.uid;
	await groups.searchMembers(data);
};

SocketGroups.loadMoreMembers = async (socket, data) => {
	if (!data.groupName || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
		throw new Error('[[error:invalid-data]]');
	}
	data.after = parseInt(data.after, 10);
	const users = user.getUsersFromSet('group:' + data.groupName + ':members', socket.uid, data.after, data.after + 9);
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
	await groups.updateCover(socket.uid, data);
};

SocketGroups.cover.remove = async (socket, data) => {
	if (!socket.uid) {
		throw new Error('[[error:no-privileges]]');
	}

	await canModifyGroup(socket.uid, data.groupName);
	await groups.removeCover(socket.uid, data);
};

async function canModifyGroup(uid, groupName) {
	const results = await utils.promiseParallel({
		isOwner: groups.ownership.isOwner(uid, groupName),
		isAdminOrGlobalMod: user.isAdminOrGlobalMod(uid),
	});

	if (!results.isOwner && !results.isAdminOrGlobalMod) {
		throw new Error('[[error:no-privileges]]');
	}
}

require('../promisify')(SocketGroups);
