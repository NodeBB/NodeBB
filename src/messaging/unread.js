'use strict';

var db = require('../database');
var sockets = require('../socket.io');

module.exports = function (Messaging) {
	Messaging.getUnreadCount = async (uid) => {
		if (parseInt(uid, 10) <= 0) {
			return 0;
		}

		return await db.sortedSetCard('uid:' + uid + ':chat:rooms:unread');
	};

	Messaging.pushUnreadCount = async (uid) => {
		if (parseInt(uid, 10) <= 0) {
			return;
		}
		const unreadCount = await Messaging.getUnreadCount(uid);
		sockets.in('uid_' + uid).emit('event:unread.updateChatCount', unreadCount);
	};

	Messaging.markRead = async (uid, roomId) => {
		await db.sortedSetRemove('uid:' + uid + ':chat:rooms:unread', roomId);
	};

	Messaging.markAllRead = async (uid) => {
		await db.delete('uid:' + uid + ':chat:rooms:unread');
	};

	Messaging.markUnread = async (uids, roomId) => {
		const exists = await Messaging.roomExists(roomId);
		if (!exists) {
			throw new Error('[[error:chat-room-does-not-exist]]');
		}
		const keys = uids.map(uid => 'uid:' + uid + ':chat:rooms:unread');
		return await db.sortedSetsAdd(keys, Date.now(), roomId);
	};
};
