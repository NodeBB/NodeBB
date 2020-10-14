'use strict';

const meta = require('../meta');
const user = require('../user');
const plugins = require('../plugins');
const privileges = require('../privileges');

const sockets = require('../socket.io');


module.exports = function (Messaging) {
	Messaging.editMessage = async (uid, mid, roomId, content) => {
		await Messaging.checkContent(content);
		const raw = await Messaging.getMessageField(mid, 'content');
		if (raw === content) {
			return;
		}

		const payload = await plugins.fireHook('filter:messaging.edit', {
			content: content,
			edited: Date.now(),
		});

		if (!String(payload.content).trim()) {
			throw new Error('[[error:invalid-chat-message]]');
		}
		await Messaging.setMessageFields(mid, payload);

		// Propagate this change to users in the room
		const [uids, messages] = await Promise.all([
			Messaging.getUidsInRoom(roomId, 0, -1),
			Messaging.getMessagesData([mid], uid, roomId, true),
		]);

		uids.forEach(function (uid) {
			sockets.in('uid_' + uid).emit('event:chats.edit', {
				messages: messages,
			});
		});
	};

	const canEditDelete = async (messageId, uid, type) => {
		let durationConfig = '';
		if (type === 'edit') {
			durationConfig = 'chatEditDuration';
		} else if (type === 'delete') {
			durationConfig = 'chatDeleteDuration';
		}

		if (meta.config.disableChat) {
			throw new Error('[[error:chat-disabled]]');
		} else if (meta.config.disableChatMessageEditing) {
			throw new Error('[[error:chat-message-editing-disabled]]');
		}

		const userData = await user.getUserFields(uid, ['banned']);
		if (userData.banned) {
			throw new Error('[[error:user-banned]]');
		}
		const canChat = await privileges.global.can('chat', uid);
		if (!canChat) {
			throw new Error('[[error:no-privileges]]');
		}

		const [isAdmin, messageData] = await Promise.all([
			user.isAdministrator(uid),
			Messaging.getMessageFields(messageId, ['fromuid', 'timestamp', 'system']),
		]);

		if (isAdmin && !messageData.system) {
			return;
		}
		const chatConfigDuration = meta.config[durationConfig];
		if (chatConfigDuration && Date.now() - messageData.timestamp > chatConfigDuration * 1000) {
			throw new Error('[[error:chat-' + type + '-duration-expired, ' + meta.config[durationConfig] + ']]');
		}

		if (messageData.fromuid === parseInt(uid, 10) && !messageData.system) {
			return;
		}

		throw new Error('[[error:cant-' + type + '-chat-message]]');
	};

	Messaging.canEdit = async (messageId, uid) => await canEditDelete(messageId, uid, 'edit');
	Messaging.canDelete = async (messageId, uid) => await canEditDelete(messageId, uid, 'delete');
};
