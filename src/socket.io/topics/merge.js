'use strict';

const topics = require('../../topics');
const privileges = require('../../privileges');

module.exports = function (SocketTopics) {
	SocketTopics.merge = async function (socket, tids) {
		if (!Array.isArray(tids)) {
			throw new Error('[[error:invalid-data]]');
		}
		const allowed = await Promise.all(tids.map(tid => privileges.topics.isAdminOrMod(tid, socket.uid)));
		if (allowed.includes(false)) {
			throw new Error('[[error:no-privileges]]');
		}
		await topics.merge(tids, socket.uid);
	};
};
