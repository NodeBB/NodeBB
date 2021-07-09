'use strict';

const user = require('../user');
const flags = require('../flags');
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
	let payload = {};
	payload = data.data.reduce((memo, cur) => {
		memo[cur.name] = cur.value;
		return memo;
	}, payload);

	return api.flags.update(socket, payload);
};

SocketFlags.appendNote = async function (socket, data) {
	if (!data || !(data.flagId && data.note)) {
		throw new Error('[[error:invalid-data]]');
	}
	const allowed = await user.isPrivileged(socket.uid);
	if (!allowed) {
		throw new Error('[[error:no-privileges]]');
	}
	if (data.datetime && data.flagId) {
		const note = await flags.getNote(data.flagId, data.datetime);
		if (note.uid !== socket.uid) {
			throw new Error('[[error:no-privileges]]');
		}
	}
	await flags.appendNote(data.flagId, socket.uid, data.note, data.datetime);
	const [notes, history] = await Promise.all([
		flags.getNotes(data.flagId),
		flags.getHistory(data.flagId),
	]);
	return { notes: notes, history: history };
};

SocketFlags.deleteNote = async function (socket, data) {
	if (!data || !(data.flagId && data.datetime)) {
		throw new Error('[[error:invalid-data]]');
	}

	const note = await flags.getNote(data.flagId, data.datetime);
	if (note.uid !== socket.uid) {
		throw new Error('[[error:no-privileges]]');
	}

	await flags.deleteNote(data.flagId, data.datetime);

	const [notes, history] = await Promise.all([
		flags.getNotes(data.flagId),
		flags.getHistory(data.flagId),
	]);
	return { notes: notes, history: history };
};

require('../promisify')(SocketFlags);
