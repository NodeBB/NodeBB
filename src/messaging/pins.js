'use strict';

const db = require('../database');

module.exports = function (Messaging) {
	Messaging.pinMessage = async (mid, roomId) => {
		const [isMessageInRoom, isSystem] = await Promise.all([
			db.isSortedSetMember(`chat:room:${roomId}:mids`, mid),
			Messaging.getMessageField(mid, 'system'),
		]);
		if (isSystem) {
			throw new Error('[[error:invalid-mid]]');
		}
		if (isMessageInRoom) {
			await db.sortedSetAdd(`chat:room:${roomId}:mids:pinned`, Date.now(), mid);
			await Messaging.setMessageFields(mid, { pinned: 1 });
		}
	};

	Messaging.unpinMessage = async (mid, roomId) => {
		const isMessageInRoom = await db.isSortedSetMember(`chat:room:${roomId}:mids`, mid);
		if (isMessageInRoom) {
			await db.sortedSetRemove(`chat:room:${roomId}:mids:pinned`, mid);
			await Messaging.setMessageFields(mid, { pinned: 0 });
		}
	};

	Messaging.getPinnedMessages = async (roomId, uid, start, stop) => {
		const mids = await db.getSortedSetRevRange(`chat:room:${roomId}:mids:pinned`, start, stop);
		if (!mids.length) {
			return [];
		}

		const canView = await Messaging.canViewMessage(mids, roomId, uid);
		const indices = mids.map((mid, i) => start + i).filter((index, i) => canView[i]);
		const visibleMids = mids.filter((mid, i) => canView[i]);
		if (!visibleMids.length) {
			return [];
		}

		const messageData = await Messaging.getMessagesData(visibleMids, uid, roomId, true);
		messageData.forEach((msg, i) => {
			if (msg) {
				msg.index = indices[i];
			}
		});
		return messageData;
	};
};
