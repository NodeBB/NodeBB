'use strict';

const _ = require('lodash');
const validator = require('validator');

const db = require('../database');
const user = require('../user');
const utils = require('../utils');
const plugins = require('../plugins');

const intFields = ['mid', 'timestamp', 'edited', 'fromuid', 'roomId', 'deleted', 'system'];

module.exports = function (Messaging) {
	Messaging.newMessageCutoff = 1000 * 60 * 3;

	Messaging.getMessagesFields = async (mids, fields) => {
		if (!Array.isArray(mids) || !mids.length) {
			return [];
		}

		const keys = mids.map(mid => `message:${mid}`);
		const messages = await db.getObjects(keys, fields);

		return await Promise.all(messages.map(
			async (message, idx) => modifyMessage(message, fields, parseInt(mids[idx], 10))
		));
	};

	Messaging.getMessageField = async (mid, field) => {
		const fields = await Messaging.getMessageFields(mid, [field]);
		return fields ? fields[field] : null;
	};

	Messaging.getMessageFields = async (mid, fields) => {
		const messages = await Messaging.getMessagesFields([mid], fields);
		return messages ? messages[0] : null;
	};

	Messaging.setMessageField = async (mid, field, content) => {
		await db.setObjectField(`message:${mid}`, field, content);
	};

	Messaging.setMessageFields = async (mid, data) => {
		await db.setObject(`message:${mid}`, data);
	};

	Messaging.getMessagesData = async (mids, uid, roomId, isNew) => {
		let messages = await Messaging.getMessagesFields(mids, []);
		messages = messages
			.map((msg, idx) => {
				if (msg) {
					msg.messageId = parseInt(mids[idx], 10);
					msg.ip = undefined;
					msg.isOwner = msg.fromuid === parseInt(uid, 10);
				}
				return msg;
			})
			.filter(Boolean);
		messages = await user.blocks.filter(uid, 'fromuid', messages);
		const users = await user.getUsersFields(
			messages.map(msg => msg && msg.fromuid),
			['uid', 'username', 'userslug', 'picture', 'status', 'banned']
		);

		messages.forEach((message, index) => {
			message.fromUser = users[index];
			message.fromUser.banned = !!message.fromUser.banned;
			message.fromUser.deleted = message.fromuid !== message.fromUser.uid && message.fromUser.uid === 0;

			const self = message.fromuid === parseInt(uid, 10);
			message.self = self ? 1 : 0;

			message.newSet = false;
			message.roomId = String(message.roomId || roomId);
		});

		await parseMessages(messages, uid, roomId, isNew);

		if (messages.length > 1) {
			// Add a spacer in between messages with time gaps between them
			messages = messages.map((message, index) => {
				// Compare timestamps with the previous message, and check if a spacer needs to be added
				if (index > 0 && message.timestamp > messages[index - 1].timestamp + Messaging.newMessageCutoff) {
					// If it's been 5 minutes, this is a new set of messages
					message.newSet = true;
				} else if (index > 0 && message.fromuid !== messages[index - 1].fromuid) {
					// If the previous message was from the other person, this is also a new set
					message.newSet = true;
				} else if (index > 0 && messages[index - 1].system) {
					message.newSet = true;
				} else if (index === 0 || message.toMid) {
					message.newSet = true;
				}

				return message;
			});
		} else if (messages.length === 1) {
			// For single messages, we don't know the context, so look up the previous message and compare
			const key = `chat:room:${roomId}:mids`;
			const index = await db.sortedSetRank(key, messages[0].messageId);
			if (index > 0) {
				const mid = await db.getSortedSetRange(key, index - 1, index - 1);
				const fields = await Messaging.getMessageFields(mid, ['fromuid', 'timestamp']);
				if ((messages[0].timestamp > fields.timestamp + Messaging.newMessageCutoff) ||
					(messages[0].fromuid !== fields.fromuid) ||
					messages[0].system || messages[0].toMid) {
					// If it's been 5 minutes, this is a new set of messages
					messages[0].newSet = true;
				}
			} else {
				messages[0].newSet = true;
			}
		}

		await addParentMessages(messages, uid, roomId);

		const data = await plugins.hooks.fire('filter:messaging.getMessages', {
			messages: messages,
			uid: uid,
			roomId: roomId,
			isNew: isNew,
			mids: mids,
		});

		return data && data.messages;
	};

	async function addParentMessages(messages, uid, roomId) {
		let parentMids = messages.map(msg => (msg && msg.hasOwnProperty('toMid') ? parseInt(msg.toMid, 10) : null)).filter(Boolean);

		if (!parentMids.length) {
			return;
		}
		parentMids = _.uniq(parentMids);
		const canView = await Messaging.canViewMessage(parentMids, roomId, uid);
		parentMids = parentMids.filter((mid, idx) => canView[idx]);

		const parentMessages = await Messaging.getMessagesFields(parentMids, [
			'fromuid', 'content', 'timestamp', 'deleted',
		]);
		const parentUids = _.uniq(parentMessages.map(msg => msg && msg.fromuid));
		const usersMap = _.zipObject(
			parentUids,
			await user.getUsersFields(parentUids, ['uid', 'username', 'userslug', 'picture'])
		);

		await Promise.all(parentMessages.map(async (parentMsg) => {
			if (parentMsg.deleted && parentMsg.fromuid !== parseInt(uid, 10)) {
				parentMsg.content = `<p>[[modules:chat.message-deleted]]</p>`;
				return;
			}
			const foundMsg = messages.find(msg => parseInt(msg.mid, 10) === parseInt(parentMsg.mid, 10));
			if (foundMsg) {
				parentMsg.content = foundMsg.content;
				return;
			}
			parentMsg.content = await parseMessage(parentMsg, uid, roomId, false);
		}));

		const parents = {};
		parentMessages.forEach((msg, i) => {
			if (usersMap[msg.fromuid]) {
				msg.user = usersMap[msg.fromuid];
				parents[parentMids[i]] = msg;
			}
		});

		messages.forEach((msg) => {
			if (parents[msg.toMid]) {
				msg.parent = parents[msg.toMid];
				msg.parent.mid = msg.toMid;
			}
		});
	}

	async function parseMessages(messages, uid, roomId, isNew) {
		await Promise.all(messages.map(async (msg) => {
			if (msg.deleted && !msg.isOwner) {
				msg.content = `<p>[[modules:chat.message-deleted]]</p>`;
				return;
			}
			msg.content = await parseMessage(msg, uid, roomId, isNew);
		}));
	}
	async function parseMessage(message, uid, roomId, isNew) {
		if (message.system) {
			return validator.escape(String(message.content));
		}

		return await Messaging.parse(message.content, message.fromuid, uid, roomId, isNew);
	}
};

async function modifyMessage(message, fields, mid) {
	if (message) {
		db.parseIntFields(message, intFields, fields);
		if (message.hasOwnProperty('timestamp')) {
			message.timestampISO = utils.toISOString(message.timestamp);
		}
		if (message.hasOwnProperty('edited')) {
			message.editedISO = utils.toISOString(message.edited);
		}
	}

	const payload = await plugins.hooks.fire('filter:messaging.getFields', {
		mid: mid,
		message: message,
		fields: fields,
	});

	return payload.message;
}
