'use strict';

const groups = require('../groups');
const user = require('../user');
const utils = require('../utils');
const privileges = require('../privileges');
const api = require('../api');
const slugify = require('../slugify');

const sockets = require('.');

const SocketGroups = module.exports;

SocketGroups.before = async (socket, method, data) => {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
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
	sockets.warnDeprecated(socket, 'GET /api/v3/groups');

	// These restrictions were left behind for websocket specific calls, the API is more flexible and requires no params
	if (!data.sort || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
		throw new Error('[[error:invalid-data]]');
	}

	return api.groups.list(socket, data);
};

SocketGroups.searchMembers = async (socket, data) => {
	sockets.warnDeprecated(socket, 'GET /api/v3/groups/:groupName/members');

	if (!data.groupName) {
		throw new Error('[[error:invalid-data]]');
	}
	data.slug = slugify(data.groupName);
	delete data.groupName;

	return api.groups.listMembers(socket, data);
};

SocketGroups.loadMoreMembers = async (socket, data) => {
	sockets.warnDeprecated(socket, 'GET /api/v3/groups/:groupName/members');

	if (!data.groupName || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
		throw new Error('[[error:invalid-data]]');
	}
	data.slug = slugify(data.groupName);
	delete data.groupName;

	return api.groups.listMembers(socket, data);
};

SocketGroups.getChatGroups = async (socket) => {
	const isAdmin = await user.isAdministrator(socket.uid);
	if (!isAdmin) {
		throw new Error('[[error:no-privileges]]');
	}
	const allGroups = await groups.getNonPrivilegeGroups('groups:createtime', 0, -1);
	const groupsList = allGroups.filter(g => !groups.ephemeralGroups.includes(g.name));
	groupsList.sort((a, b) => b.system - a.system);
	return groupsList.map(g => ({ name: g.name, displayName: g.displayName }));
};

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
		hasAdminPrivilege: privileges.admin.can('admin:groups', uid),
		isGlobalMod: user.isGlobalModerator(uid),
	});

	if (!(results.isOwner || results.hasAdminPrivilege || (results.isGlobalMod && !results.system))) {
		throw new Error('[[error:no-privileges]]');
	}
}

require('../promisify')(SocketGroups);
