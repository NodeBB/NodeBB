'use strict';

const user = require('../user');
const flags = require('../flags');

const SocketFlags = module.exports;

SocketFlags.create = async function (socket, data) {
	if (!socket.uid) {
		throw new Error('[[error:not-logged-in]]');
	}

	if (!data || !data.type || !data.id || !data.reason) {
		throw new Error('[[error:invalid-data]]');
	}
	await flags.validate({
		uid: socket.uid,
		type: data.type,
		id: data.id,
	});

	const flagObj = await flags.create(data.type, data.id, socket.uid, data.reason);
	await flags.notify(flagObj, socket.uid);
	return flagObj.flagId;
};

SocketFlags.update = async function (socket, data) {
	if (!data || !(data.flagId && data.data)) {
		throw new Error('[[error:invalid-data]]');
	}

	const allowed = await user.isPrivileged(socket.uid);
	if (!allowed) {
		throw new Error('[[no-privileges]]');
	}
	let payload = {};
	// Translate form data into object
	payload = data.data.reduce(function (memo, cur) {
		memo[cur.name] = cur.value;
		return memo;
	}, payload);

	await flags.update(data.flagId, socket.uid, payload);
	return await flags.getHistory(data.flagId);
};

SocketFlags.appendNote = async function (socket, data) {
	if (!data || !(data.flagId && data.note)) {
		throw new Error('[[error:invalid-data]]');
	}

	const allowed = await user.isPrivileged(socket.uid);
	if (!allowed) {
		throw new Error('[[no-privileges]]');
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
