'use strict';

const topics = require('../../topics');
const privileges = require('../../privileges');

module.exports = function (SocketTopics) {
	SocketTopics.merge = async function (socket, data) {
		if (!data || !Array.isArray(data.tids)) {
			throw new Error('[[error:invalid-data]]');
		}
		const allowed = await Promise.all(data.tids.map(tid => privileges.topics.isAdminOrMod(tid, socket.uid)));
		if (allowed.includes(false)) {
			throw new Error('[[error:no-privileges]]');
		}
		if (data.options && data.options.mainTid && !data.tids.includes(data.options.mainTid)) {
			throw new Error('[[error:invalid-data]]');
		}
		const mergeIntoTid = await topics.merge(data.tids, socket.uid, data.options);
		return mergeIntoTid;
	};
};
