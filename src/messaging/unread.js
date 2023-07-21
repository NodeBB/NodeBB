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

	Messaging.pushUnreadCount = async (uids, data = null) => {
		if (!Array.isArray(uids)) {
			uids = [uids];
		}
		uids = uids.filter(uid => parseInt(uid, 10) > 0);
		if (!uids.length) {
			return;
		}
		uids.forEach((uid) => {
			io.in(`uid_${uid}`).emit('event:unread.updateChatCount', data);
		});
	};

	Messaging.markRead = async (uid, roomId) => {
		await Promise.all([
			db.sortedSetRemove(`uid:${uid}:chat:rooms:unread`, roomId),
			db.setObjectField(`uid:${uid}:chat:rooms:read`, roomId, Date.now()),
		]);
	};

	Messaging.hasRead = async (uids, roomId) => {
		if (!uids.length) {
			return [];
		}
		const roomData = await Messaging.getRoomData(roomId);
		if (!roomData) {
			return uids.map(() => false);
		}
		if (roomData.public) {
			const [userTimestamps, mids] = await Promise.all([
				db.getObjectsFields(uids.map(uid => `uid:${uid}:chat:rooms:read`), [roomId]),
				db.getSortedSetRevRangeWithScores(`chat:room:${roomId}:mids`, 0, 0),
			]);
			const lastMsgTimestamp = mids[0] ? mids[0].score : 0;
			return uids.map(
				(uid, index) => !userTimestamps[index] ||
					!userTimestamps[index][roomId] ||
					parseInt(userTimestamps[index][roomId], 10) > lastMsgTimestamp
			);
		}
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
