'use strict';

const db = require('../../database');
const user = require('../../user');
const topics = require('../../topics');

module.exports = function (SocketTopics) {
	SocketTopics.markAsRead = async function (socket, tids) {
		if (!Array.isArray(tids) || socket.uid <= 0) {
			throw new Error('[[error:invalid-data]]');
		}
		const hasMarked = await topics.markAsRead(tids, socket.uid);
		const promises = [topics.markTopicNotificationsRead(tids, socket.uid)];
		if (hasMarked) {
			promises.push(topics.pushUnreadCount(socket.uid));
		}
		await Promise.all(promises);
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
		if (!tid || socket.uid <= 0) {
			throw new Error('[[error:invalid-data]]');
		}
		await topics.markUnread(tid, socket.uid);
		topics.pushUnreadCount(socket.uid);
	};

	SocketTopics.markAsUnreadForAll = async function (socket, tids) {
		if (!Array.isArray(tids)) {
			throw new Error('[[error:invalid-tid]]');
		}

		if (socket.uid <= 0) {
			throw new Error('[[error:no-privileges]]');
		}
		const isAdmin = await user.isAdministrator(socket.uid);
		const now = Date.now();
		await Promise.all(tids.map(async (tid) => {
			const topicData = await topics.getTopicFields(tid, ['tid', 'cid']);
			if (!topicData.tid) {
				throw new Error('[[error:no-topic]]');
			}
			const isMod = await user.isModerator(socket.uid, topicData.cid);
			if (!isAdmin && !isMod) {
				throw new Error('[[error:no-privileges]]');
			}
			await topics.markAsUnreadForAll(tid);
			await topics.updateRecent(tid, now);
			await db.sortedSetAdd('cid:' + topicData.cid + ':tids:lastposttime', now, tid);
			await topics.setTopicField(tid, 'lastposttime', now);
		}));
		topics.pushUnreadCount(socket.uid);
	};
};
