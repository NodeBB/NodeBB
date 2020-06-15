'use strict';

const meta = require('../meta');
const plugins = require('../plugins');
const db = require('../database');
const user = require('../user');

module.exports = function (Messaging) {
	Messaging.sendMessage = async (data) => {
		await Messaging.checkContent(data.content);
		const inRoom = await Messaging.isUserInRoom(data.uid, data.roomId);
		if (!inRoom) {
			throw new Error('[[error:not-allowed]]');
		}

		return await Messaging.addMessage(data);
	};

	Messaging.checkContent = async (content) => {
		if (!content) {
			throw new Error('[[error:invalid-chat-message]]');
		}

		const maximumChatMessageLength = meta.config.maximumChatMessageLength || 1000;
		const data = await plugins.fireHook('filter:messaging.checkContent', { content: content });
		content = String(data.content).trim();
		if (!content) {
			throw new Error('[[error:invalid-chat-message]]');
		}
		if (content.length > maximumChatMessageLength) {
			throw new Error('[[error:chat-message-too-long, ' + maximumChatMessageLength + ']]');
		}
	};

	Messaging.addMessage = async (data) => {
		const mid = await db.incrObjectField('global', 'nextMid');
		const timestamp = data.timestamp || Date.now();
		let message = {
			content: String(data.content),
			timestamp: timestamp,
			fromuid: data.uid,
			roomId: data.roomId,
			deleted: 0,
			system: data.system || 0,
		};

		if (data.ip) {
			message.ip = data.ip;
		}

		message = await plugins.fireHook('filter:messaging.save', message);
		await db.setObject('message:' + mid, message);
		const isNewSet = await Messaging.isNewSet(data.uid, data.roomId, timestamp);
		let uids = await db.getSortedSetRange('chat:room:' + data.roomId + ':uids', 0, -1);
		uids = await user.blocks.filterUids(data.uid, uids);

		await Promise.all([
			Messaging.addRoomToUsers(data.roomId, uids, timestamp),
			Messaging.addMessageToUsers(data.roomId, uids, mid, timestamp),
			Messaging.markUnread(uids.filter(uid => uid !== String(data.uid)), data.roomId),
		]);

		const messages = await Messaging.getMessagesData([mid], data.uid, data.roomId, true);
		if (!messages || !messages[0]) {
			return null;
		}

		messages[0].newSet = isNewSet;
		messages[0].mid = mid;
		messages[0].roomId = data.roomId;
		plugins.fireHook('action:messaging.save', { message: messages[0], data: data });
		return messages[0];
	};

	Messaging.addSystemMessage = async (content, uid, roomId) => {
		const message = await Messaging.addMessage({
			content: content,
			uid: uid,
			roomId: roomId,
			system: 1,
		});
		Messaging.notifyUsersInRoom(uid, roomId, message);
	};

	Messaging.addRoomToUsers = async (roomId, uids, timestamp) => {
		if (!uids.length) {
			return;
		}

		const keys = uids.map(uid => 'uid:' + uid + ':chat:rooms');
		await db.sortedSetsAdd(keys, timestamp, roomId);
	};

	Messaging.addMessageToUsers = async (roomId, uids, mid, timestamp) => {
		if (!uids.length) {
			return;
		}
		const keys = uids.map(uid => 'uid:' + uid + ':chat:room:' + roomId + ':mids');
		await db.sortedSetsAdd(keys, timestamp, mid);
	};
};
