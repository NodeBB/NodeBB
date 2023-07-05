'use strict';

const db = require('../database');
const io = require('../socket.io');

module.exports = function (Messaging) {
	Messaging.getUnreadCount = async (uid) => {
		if (!(parseInt(uid, 10) > 0)) {
			return 0;
		}

		return await db.sortedSetCard(`uid:${uid}:chat:rooms:unread`);
	};

	Messaging.pushUnreadCount = async (uids, message = null) => {
		if (!Array.isArray(uids)) {
			uids = [uids];
		}
		uids = uids.filter(uid => parseInt(uid, 10) > 0);
		if (!uids.length) {
			return;
		}

		uids.forEach((uid) => {
			io.in(`uid_${uid}`).emit('event:unread.updateChatCount', {
				message: message,
			});
		});
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
