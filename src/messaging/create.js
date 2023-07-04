'use strict';

const _ = require('lodash');

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
		content = String(content).trim();
		let { length } = content;
		({ content, length } = await plugins.hooks.fire('filter:messaging.checkContent', { content, length }));
		if (!content) {
			throw new Error('[[error:invalid-chat-message]]');
		}
		if (length > maximumChatMessageLength) {
			throw new Error(`[[error:chat-message-too-long, ${maximumChatMessageLength}]]`);
		}
	};

	Messaging.addMessage = async (data) => {
		const mid = await db.incrObjectField('global', 'nextMid');
		const timestamp = data.timestamp || Date.now();
		const { uid, roomId } = data;
		let message = {
			content: String(data.content),
			timestamp: timestamp,
			fromuid: uid,
			roomId: roomId,
			deleted: 0,
			system: data.system || 0,
		};

		if (data.ip) {
			message.ip = data.ip;
		}
		const roomData = await Messaging.getRoomData(roomId);
		if (!roomData) {
			throw new Error('[[error:no-room]]');
		}

		message = await plugins.hooks.fire('filter:messaging.save', message);
		await db.setObject(`message:${mid}`, message);
		const isNewSet = await Messaging.isNewSet(uid, roomId, timestamp);

		// TODO: dont load all uids in the room if its a public room
		let uids = await db.getSortedSetRange(`chat:room:${roomId}:uids`, 0, -1);
		uids = await user.blocks.filterUids(uid, uids);

		await Promise.all([
			Messaging.addMessageToRoom(roomId, mid, timestamp),

			roomData.public ? Promise.resolve() : Messaging.addRoomToUsers(roomId, uids, timestamp),

			Messaging.markUnread(uids.filter(uid => uid !== String(data.uid)), roomId),
		]);

		const messages = await Messaging.getMessagesData([mid], uid, roomId, true);
		if (!messages || !messages[0]) {
			return null;
		}

		messages[0].newSet = isNewSet;
		messages[0].mid = mid;
		messages[0].roomId = roomId;
		plugins.hooks.fire('action:messaging.save', { message: messages[0], data: data });
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
		const keys = _.uniq(uids).map(uid => `uid:${uid}:chat:rooms`);
		await db.sortedSetsAdd(keys, timestamp, roomId);
	};

	Messaging.addMessageToRoom = async (roomId, mid, timestamp) => {
		await db.sortedSetAdd(`chat:room:${roomId}:mids`, timestamp, mid);
	};
};
