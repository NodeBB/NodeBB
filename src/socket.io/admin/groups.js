'use strict';

const groups = require('../../groups');
const sockets = require('..');
const api = require('../../api');

const Groups = module.exports;

Groups.create = async function (socket, data) {
	sockets.warnDeprecated(socket, 'POST /api/v3/groups');

	if (!data) {
		throw new Error('[[error:invalid-data]]');
	} else if (groups.isPrivilegeGroup(data.name)) {
		throw new Error('[[error:invalid-group-name]]');
	}

	return await groups.create({
		name: data.name,
		description: data.description,
		private: data.private,
		hidden: data.hidden,
		ownerUid: socket.uid,
	});
};

Groups.join = async (socket, data) => {
	sockets.warnDeprecated(socket, 'PUT /api/v3/groups/:slug/membership/:uid');
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	const slug = await groups.getGroupField(data.groupName, 'slug');
	return await api.groups.join(socket, { slug: slug, uid: data.uid });
};

Groups.leave = async function (socket, data) {
	sockets.warnDeprecated(socket, 'DELETE /api/v3/groups/:slug/membership/:uid');
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	const slug = await groups.getGroupField(data.groupName, 'slug');
	await api.groups.leave(socket, { slug: slug, uid: data.uid });
};

Groups.update = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	await groups.update(data.groupName, data.values);
};
