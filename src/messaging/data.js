'use strict';

const validator = require('validator');

const db = require('../database');
const user = require('../user');
const utils = require('../utils');
const plugins = require('../plugins');

const intFields = ['timestamp', 'edited', 'fromuid', 'roomId', 'deleted', 'system'];

module.exports = function (Messaging) {
	Messaging.newMessageCutoff = 1000 * 60 * 3;

	Messaging.getMessagesFields = async (mids, fields) => {
		if (!Array.isArray(mids) || !mids.length) {
			return [];
		}

		const keys = mids.map(mid => 'message:' + mid);
		let messages;
		if (fields.length) {
			messages = await db.getObjectsFields(keys, fields);
		} else {
			messages = await db.getObjects(keys);
		}

		messages.forEach(message => modifyMessage(message, fields));
		return messages;
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
		await db.setObjectField('message:' + mid, field, content);
	};

	Messaging.setMessageFields = async (mid, data) => {
		await db.setObject('message:' + mid, data);
	};

	Messaging.getMessagesData = async (mids, uid, roomId, isNew) => {
		let messages = await Messaging.getMessagesFields(mids, []);
		messages = await user.blocks.filter(uid, 'fromuid', messages);
		messages = messages
			.map(function (msg, idx) {
				if (msg) {
					msg.messageId = parseInt(mids[idx], 10);
					msg.ip = undefined;
				}
				return msg;
			})
			.filter(Boolean);

		const users = await user.getUsersFields(
			messages.map(msg => msg && msg.fromuid),
			['uid', 'username', 'userslug', 'picture', 'status', 'banned']
		);

		messages.forEach(function (message, index) {
			message.fromUser = users[index];
			message.fromUser.banned = !!message.fromUser.banned;
			message.fromUser.deleted = message.fromuid !== message.fromUser.uid && message.fromUser.uid === 0;

			var self = message.fromuid === parseInt(uid, 10);
			message.self = self ? 1 : 0;

			message.newSet = false;
			message.roomId = String(message.roomId || roomId);
			message.deleted = !!message.deleted;
			message.system = !!message.system;
		});

		messages = await Promise.all(messages.map(async (message) => {
			if (message.system) {
				message.content = validator.escape(String(message.content));
				message.cleanedContent = utils.stripHTMLTags(utils.decodeHTMLEntities(message.content));
				return message;
			}

			const result = await Messaging.parse(message.content, message.fromuid, uid, roomId, isNew);
			message.content = result;
			message.cleanedContent = utils.stripHTMLTags(utils.decodeHTMLEntities(result));
			return message;
		}));

		if (messages.length > 1) {
			// Add a spacer in between messages with time gaps between them
			messages = messages.map(function (message, index) {
				// Compare timestamps with the previous message, and check if a spacer needs to be added
				if (index > 0 && message.timestamp > messages[index - 1].timestamp + Messaging.newMessageCutoff) {
					// If it's been 5 minutes, this is a new set of messages
					message.newSet = true;
				} else if (index > 0 && message.fromuid !== messages[index - 1].fromuid) {
					// If the previous message was from the other person, this is also a new set
					message.newSet = true;
				} else if (index === 0) {
					message.newSet = true;
				}

				return message;
			});
		} else if (messages.length === 1) {
			// For single messages, we don't know the context, so look up the previous message and compare
			var key = 'uid:' + uid + ':chat:room:' + roomId + ':mids';
			const index = await db.sortedSetRank(key, messages[0].messageId);
			if (index > 0) {
				const mid = await db.getSortedSetRange(key, index - 1, index - 1);
				const fields = await Messaging.getMessageFields(mid, ['fromuid', 'timestamp']);
				if ((messages[0].timestamp > fields.timestamp + Messaging.newMessageCutoff) ||
					(messages[0].fromuid !== fields.fromuid)) {
					// If it's been 5 minutes, this is a new set of messages
					messages[0].newSet = true;
				}
			} else {
				messages[0].newSet = true;
			}
		} else {
			messages = [];
		}

		const data = await plugins.fireHook('filter:messaging.getMessages', {
			messages: messages,
			uid: uid,
			roomId: roomId,
			isNew: isNew,
			mids: mids,
		});

		return data && data.messages;
	};
};

function modifyMessage(message, fields) {
	if (message) {
		db.parseIntFields(message, intFields, fields);
		if (message.hasOwnProperty('timestamp')) {
			message.timestampISO = utils.toISOString(message.timestamp);
		}
		if (message.hasOwnProperty('edited')) {
			message.editedISO = utils.toISOString(message.edited);
		}
	}
}
