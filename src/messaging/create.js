'use strict';

const _ = require('lodash');

const meta = require('../meta');
const plugins = require('../plugins');
const db = require('../database');
const user = require('../user');
const utils = require('../utils');

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
		const { uid, roomId } = data;
		const roomData = await Messaging.getRoomData(roomId);
		if (!roomData) {
			throw new Error('[[error:no-room]]');
		}
		if (data.toMid) {
			if (!utils.isNumber(data.toMid)) {
				throw new Error('[[error:invalid-mid]]');
			}
			if (!await Messaging.canViewMessage(data.toMid, roomId, uid)) {
				throw new Error('[[error:no-privileges]]');
			}
		}
		const mid = await db.incrObjectField('global', 'nextMid');
		const timestamp = data.timestamp || Date.now();
		let message = {
			mid: mid,
			content: String(data.content),
			timestamp: timestamp,
			fromuid: uid,
			roomId: roomId,
		};
		if (data.toMid) {
			message.toMid = data.toMid;
		}
		if (data.system) {
			message.system = data.system;
		}

		if (data.ip) {
			message.ip = data.ip;
		}

		message = await plugins.hooks.fire('filter:messaging.save', message);
		await db.setObject(`message:${mid}`, message);
		const isNewSet = await Messaging.isNewSet(uid, roomId, timestamp);

		const tasks = [
			Messaging.addMessageToRoom(roomId, mid, timestamp),
			Messaging.markRead(uid, roomId),
			db.sortedSetAdd('messages:mid', timestamp, mid),
			db.incrObjectField('global', 'messageCount'),
		];
		if (data.toMid) {
			tasks.push(db.sortedSetAdd(`mid:${data.toMid}:replies`, timestamp, mid));
		}
		if (roomData.public) {
			tasks.push(
				db.sortedSetAdd('chat:rooms:public:lastpost', timestamp, roomId)
			);
		} else {
			let uids = await Messaging.getUidsInRoom(roomId, 0, -1);
			uids = await user.blocks.filterUids(uid, uids);
			tasks.push(
				Messaging.addRoomToUsers(roomId, uids, timestamp),
				Messaging.markUnread(uids.filter(uid => uid !== String(data.uid)), roomId),
			);
		}
		await Promise.all(tasks);

		const messages = await Messaging.getMessagesData([mid], uid, roomId, true);
		if (!messages || !messages[0]) {
			return null;
		}

		messages[0].newSet = isNewSet;
		plugins.hooks.fire('action:messaging.save', { message: message, data: data });
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
		await db.incrObjectField(`chat:room:${roomId}`, 'messageCount');
	};
};
