'use strict';

const topics = require('../../topics');

const api = require('../../api');
const sockets = require('..');

module.exports = function (SocketTopics) {
	SocketTopics.markAsRead = async function (socket, tids) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/topics/:tid/read');

		if (!Array.isArray(tids) || socket.uid <= 0) {
			throw new Error('[[error:invalid-data]]');
		}

		await Promise.all(tids.map(async tid => api.topics.markRead(socket, { tid })));
	};

	SocketTopics.markTopicNotificationsRead = async function (socket, tids) {
		if (!Array.isArray(tids) || !socket.uid) {
			throw new Error('[[error:invalid-data]]');
		}
		await topics.markTopicNotificationsRead(tids, socket.uid);
	};

	SocketTopics.markAllRead = async function (socket) {
		if (socket.uid <= 0) {
			throw new Error('[[error:invalid-uid]]');
		}
		await topics.markAllRead(socket.uid);
		topics.pushUnreadCount(socket.uid);
	};

	SocketTopics.markCategoryTopicsRead = async function (socket, cid) {
		const tids = await topics.getUnreadTids({ cid: cid, uid: socket.uid, filter: '' });
		await SocketTopics.markAsRead(socket, tids);
	};

	SocketTopics.markUnread = async function (socket, tid) {
		sockets.warnDeprecated(socket, 'DELETE /api/v3/topics/:tid/read');

		if (!tid || socket.uid <= 0) {
			throw new Error('[[error:invalid-data]]');
		}

		await api.topics.markUnread(socket, { tid });
	};

	SocketTopics.markAsUnreadForAll = async function (socket, tids) {
		sockets.warnDeprecated(socket, 'PUT /api/v3/topics/:tid/bump');

		if (!Array.isArray(tids)) {
			throw new Error('[[error:invalid-tid]]');
		}

		if (socket.uid <= 0) {
			throw new Error('[[error:no-privileges]]');
		}

		await Promise.all(tids.map(async tid => api.topics.bump(socket, { tid })));
	};
};
