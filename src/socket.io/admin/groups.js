'use strict';

const groups = require('../../groups');
const sockets = require('..');

const Groups = module.exports;

Groups.create = async function (socket, data) {
	sockets.warnDeprecated(socket, 'POST /api/v1/groups');

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
	sockets.warnDeprecated(socket, 'PUT /api/v1/groups/:slug/membership/:uid');

	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	const isMember = await groups.isMember(data.uid, data.groupName);
	if (isMember) {
		throw new Error('[[error:group-already-member]]');
	}

	return await groups.join(data.groupName, data.uid);
};

Groups.leave = async function (socket, data) {
	sockets.warnDeprecated(socket, 'DELETE /api/v1/groups/:slug/membership/:uid');

	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	if (socket.uid === parseInt(data.uid, 10) && data.groupName === 'administrators') {
		throw new Error('[[error:cant-remove-self-as-admin]]');
	}
	const isMember = await groups.isMember(data.uid, data.groupName);
	if (!isMember) {
		throw new Error('[[error:group-not-member]]');
	}
	await groups.leave(data.groupName, data.uid);
};

Groups.update = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	await groups.update(data.groupName, data.values);
};
