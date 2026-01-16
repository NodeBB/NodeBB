'use strict';

const db = require('../database');
const meta = require('../meta');
const user = require('../user');
const plugins = require('../plugins');
const activitypub = require('../activitypub');
const privileges = require('../privileges');
const utils = require('../utils');

const sockets = require('../socket.io');


module.exports = function (Messaging) {
	Messaging.editMessage = async (uid, mid, roomId, content) => {
		await Messaging.checkContent(content);
		const isPublic = parseInt(await db.getObjectField(`chat:room:${roomId}`, 'public'), 10) === 1;
		const raw = await Messaging.getMessageField(mid, 'content');
		if (raw === content) {
			return;
		}

		const payload = await plugins.hooks.fire('filter:messaging.edit', {
			content: content,
			edited: Date.now(),
		});

		if (!String(payload.content).trim()) {
			throw new Error('[[error:invalid-chat-message]]');
		}
		await Messaging.setMessageFields(mid, payload);

		// Propagate this change to users in the room
		const messages = await Messaging.getMessagesData([mid], uid, roomId, true);
		if (messages[0]) {
			const roomName = messages[0].deleted ? `uid_${uid}` : `chat_room_${roomId}`;
			sockets.in(roomName).emit('event:chats.edit', {
				messages: messages,
			});

			if (!isPublic && utils.isNumber(messages[0].fromuid)) {
				activitypub.out.update.privateNote(messages[0].fromuid, messages[0]);
			}
		}

		plugins.hooks.fire('action:messaging.edit', {
			message: { ...messages[0], content: payload.content },
		});
	};

	const canEditDelete = async (messageId, uid, type) => {
		let durationConfig = '';
		if (type === 'edit') {
			durationConfig = 'chatEditDuration';
		} else if (type === 'delete') {
			durationConfig = 'chatDeleteDuration';
		}

		const exists = await Messaging.messageExists(messageId);
		if (!exists) {
			throw new Error('[[error:invalid-mid]]');
		}

		const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(uid);

		if (meta.config.disableChat) {
			throw new Error('[[error:chat-disabled]]');
		} else if (!isAdminOrGlobalMod && meta.config.disableChatMessageEditing) {
			throw new Error('[[error:chat-message-editing-disabled]]');
		}

		const userData = await user.getUserFields(uid, ['banned']);
		if (userData.banned) {
			throw new Error('[[error:user-banned]]');
		}

		const canChat = await privileges.global.can(['chat', 'chat:privileged'], uid);
		if (!canChat.includes(true)) {
			throw new Error('[[error:no-privileges]]');
		}

		const messageData = await Messaging.getMessageFields(messageId, ['fromuid', 'timestamp', 'system']);
		if (isAdminOrGlobalMod && !messageData.system) {
			return;
		}

		const chatConfigDuration = meta.config[durationConfig];
		if (chatConfigDuration && Date.now() - messageData.timestamp > chatConfigDuration * 1000) {
			throw new Error(`[[error:chat-${type}-duration-expired, ${meta.config[durationConfig]}]]`);
		}

		if (String(messageData.fromuid) === String(uid) && !messageData.system) {
			return;
		}

		throw new Error(`[[error:cant-${type}-chat-message]]`);
	};

	Messaging.canEdit = async (messageId, uid) => await canEditDelete(messageId, uid, 'edit');
	Messaging.canDelete = async (messageId, uid) => await canEditDelete(messageId, uid, 'delete');

	Messaging.canPin = async (roomId, uid) => {
		const [isAdmin, isGlobalMod, inRoom, isRoomOwner] = await Promise.all([
			user.isAdministrator(uid),
			user.isGlobalModerator(uid),
			Messaging.isUserInRoom(uid, roomId),
			Messaging.isRoomOwner(uid, roomId),
		]);
		if (!isAdmin && !isGlobalMod && (!inRoom || !isRoomOwner)) {
			throw new Error('[[error:no-privileges]]');
		}
	};
};
