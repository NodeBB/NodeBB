'use strict';

const groups = require('../groups');
const user = require('../user');
const utils = require('../utils');
const events = require('../events');
const privileges = require('../privileges');
const api = require('../api');
const sockets = require('.');

const SocketGroups = module.exports;

SocketGroups.before = async (socket, method, data) => {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
};

SocketGroups.join = async (socket, data) => {
	sockets.warnDeprecated(socket, 'PUT /api/v3/groups/:slug/membership/:uid');
	const slug = await groups.getGroupField(data.groupName, 'slug');
	await api.groups.join(socket, { slug: slug, uid: data.uid || socket.uid });
};

SocketGroups.leave = async (socket, data) => {
	sockets.warnDeprecated(socket, 'DELETE /api/v3/groups/:slug/membership/:uid');
	const slug = await groups.getGroupField(data.groupName, 'slug');
	await api.groups.leave(socket, { slug: slug, uid: data.uid || socket.uid });
};

SocketGroups.addMember = async (socket, data) => {
	await isOwner(socket, data);
	if (data.groupName === 'administrators' || groups.isPrivilegeGroup(data.groupName)) {
		throw new Error('[[error:not-allowed]]');
	}
	if (!data.uid) {
		throw new Error('[[error:invalid-data]]');
	}
	data.uid = !Array.isArray(data.uid) ? [data.uid] : data.uid;
	if (data.uid.filter(uid => !(parseInt(uid, 10) > 0)).length) {
		throw new Error('[[error:invalid-uid]]');
	}
	for (const uid of data.uid) {
		// eslint-disable-next-line no-await-in-loop
		await groups.join(data.groupName, uid);
	}

	logGroupEvent(socket, 'group-add-member', {
		groupName: data.groupName,
		targetUid: String(data.uid),
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
	sockets.warnDeprecated(socket, 'PUT /api/v3/groups/:slug');
	await isOwner(socket, data);

	const slug = await groups.getGroupField(data.groupName, 'slug');
	await api.groups.update(socket, { slug, ...data.values });
	// await groups.update(data.groupName, data.values);
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
	sockets.warnDeprecated(socket, 'POST /api/v3/groups');
	const groupData = await api.groups.create(socket, data);
	return groupData;
};

SocketGroups.delete = async (socket, data) => {
	sockets.warnDeprecated(socket, 'DEL /api/v3/groups');
	const slug = await groups.getGroupField(data.groupName, 'slug');
	await api.groups.delete(socket, { slug: slug });
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
	if (!data.groupName) {
		throw new Error('[[error:invalid-data]]');
	}
	await canSearchMembers(socket.uid, data.groupName);
	if (!await privileges.global.can('search:users', socket.uid)) {
		throw new Error('[[error:no-privileges]]');
	}
	return await groups.searchMembers({
		uid: socket.uid,
		query: data.query,
		groupName: data.groupName,
	});
};

SocketGroups.loadMoreMembers = async (socket, data) => {
	if (!data.groupName || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
		throw new Error('[[error:invalid-data]]');
	}
	await canSearchMembers(socket.uid, data.groupName);
	data.after = parseInt(data.after, 10);
	const users = await groups.getOwnersAndMembers(data.groupName, socket.uid, data.after, data.after + 9);
	return {
		users: users,
		nextStart: data.after + 10,
	};
};

async function canSearchMembers(uid, groupName) {
	const [isHidden, isMember, isAdmin, isGlobalMod, viewGroups] = await Promise.all([
		groups.isHidden(groupName),
		groups.isMember(uid, groupName),
		user.isAdministrator(uid),
		user.isGlobalModerator(uid),
		privileges.global.can('view:groups', uid),
	]);

	if (!viewGroups || (isHidden && !isMember && !isAdmin && !isGlobalMod)) {
		throw new Error('[[error:no-privileges]]');
	}
}

SocketGroups.cover = {};

SocketGroups.cover.update = async (socket, data) => {
	if (!socket.uid) {
		throw new Error('[[error:no-privileges]]');
	}
	if (data.file || (!data.imageData && !data.position)) {
		throw new Error('[[error:invalid-data]]');
	}
	await canModifyGroup(socket.uid, data.groupName);
	return await groups.updateCover(socket.uid, {
		groupName: data.groupName,
		imageData: data.imageData,
		position: data.position,
	});
};

SocketGroups.cover.remove = async (socket, data) => {
	if (!socket.uid) {
		throw new Error('[[error:no-privileges]]');
	}

	await canModifyGroup(socket.uid, data.groupName);
	await groups.removeCover({
		groupName: data.groupName,
	});
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
