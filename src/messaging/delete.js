'use strict';

const sockets = require('../socket.io');
const plugins = require('../plugins');

module.exports = function (Messaging) {
	Messaging.deleteMessage = async (mid, uid) => await doDeleteRestore(mid, 1, uid);
	Messaging.restoreMessage = async (mid, uid) => await doDeleteRestore(mid, 0, uid);

	async function doDeleteRestore(mid, state, uid) {
		const field = state ? 'deleted' : 'restored';
		const msgData = await Messaging.getMessageFields(mid, [
			'mid', 'fromuid', 'deleted', 'roomId', 'content', 'system',
		]);
		if (msgData.deleted === state) {
			throw new Error(`[[error:chat-${field}-already]]`);
		}

		await Messaging.setMessageField(mid, 'deleted', state);
		msgData.deleted = state;
		const ioRoom = sockets.in(`chat_room_${msgData.roomId}`);
		if (state === 1 && ioRoom) {
			ioRoom.emit('event:chats.delete', mid);
			plugins.hooks.fire('action:messaging.delete', { message: msgData });
		} else if (state === 0 && ioRoom) {
			const messages = await Messaging.getMessagesData([mid], uid, msgData.roomId, true);
			ioRoom.emit('event:chats.restore', messages[0]);
			plugins.hooks.fire('action:messaging.restore', { message: msgData });
		}
	}
};
