'use strict';

const sockets = require('.');
const api = require('../api');

const SocketFlags = module.exports;

SocketFlags.create = async function (socket, data) {
	sockets.warnDeprecated(socket, 'POST /api/v3/flags');
	const response = await api.flags.create(socket, data);
	if (response) {
		return response.flagId;
	}
};

SocketFlags.update = async function (socket, data) {
	sockets.warnDeprecated(socket, 'PUT /api/v3/flags/:flagId');
	if (!data || !(data.flagId && data.data)) {	// check only req'd in socket.io
		throw new Error('[[error:invalid-data]]');
	}

	// Old socket method took input directly from .serializeArray(), v3 expects fully-formed obj.
	let payload = {
		flagId: data.flagId,
	};
	payload = data.data.reduce((memo, cur) => {
		memo[cur.name] = cur.value;
		return memo;
	}, payload);

	return await api.flags.update(socket, payload);
};

SocketFlags.appendNote = async function (socket, data) {
	sockets.warnDeprecated(socket, 'POST /api/v3/flags/:flagId/notes');
	if (!data || !(data.flagId && data.note)) {
		throw new Error('[[error:invalid-data]]');
	}

	return await api.flags.appendNote(socket, data);
};

SocketFlags.deleteNote = async function (socket, data) {
	sockets.warnDeprecated(socket, 'DELETE /api/v3/flags/:flagId/notes/:datetime');
	if (!data || !(data.flagId && data.datetime)) {
		throw new Error('[[error:invalid-data]]');
	}

	return await api.flags.deleteNote(socket, data);
};

require('../promisify')(SocketFlags);
