'use strict';

const db = require('../database');
const sockets = require('../socket.io');

module.exports = function (Messaging) {
	Messaging.getUnreadCount = async (uid) => {
		if (parseInt(uid, 10) <= 0) {
			return 0;
		}

		return await db.sortedSetCard(`uid:${uid}:chat:rooms:unread`);
	};

	Messaging.pushUnreadCount = async (uid) => {
		if (parseInt(uid, 10) <= 0) {
			return;
		}
		const unreadCount = await Messaging.getUnreadCount(uid);
		sockets.in(`uid_${uid}`).emit('event:unread.updateChatCount', unreadCount);
	};

	Messaging.markRead = async (uid, roomId) => {
		await Promise.all([
			db.sortedSetRemove(`uid:${uid}:chat:rooms:unread`, roomId),
			db.setObjectField(`uid:${uid}:chat:rooms:read`, roomId, Date.now()),
		]);
	};

	Messaging.hasRead = async (uids, roomId) => {
		const isMembers = await db.isMemberOfSortedSets(
			uids.map(uid => `uid:${uid}:chat:rooms:unread`),
			roomId
		);
		return uids.map((uid, index) => !isMembers[index]);
	};

	Messaging.markAllRead = async (uid) => {
		await db.delete(`uid:${uid}:chat:rooms:unread`);
	};

	Messaging.markUnread = async (uids, roomId) => {
		const exists = await Messaging.roomExists(roomId);
		if (!exists) {
			return;
		}
		const keys = uids.map(uid => `uid:${uid}:chat:rooms:unread`);
		await db.sortedSetsAdd(keys, Date.now(), roomId);
	};
};
