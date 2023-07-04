'use strict';

const sockets = require('../socket.io');

module.exports = function (Messaging) {
	Messaging.deleteMessage = async (mid, uid) => await doDeleteRestore(mid, 1, uid);
	Messaging.restoreMessage = async (mid, uid) => await doDeleteRestore(mid, 0, uid);

	async function doDeleteRestore(mid, state, uid) {
		const field = state ? 'deleted' : 'restored';
		const { deleted, roomId } = await Messaging.getMessageFields(mid, ['deleted', 'roomId']);
		if (deleted === state) {
			throw new Error(`[[error:chat-${field}-already]]`);
		}

		await Messaging.setMessageField(mid, 'deleted', state);

		const messages = await Messaging.getMessagesData([mid], uid, roomId, true);
		const ioRoom = sockets.in(`chat_room_${roomId}`);
		if (state === 1 && ioRoom) {
			ioRoom.emit('event:chats.delete', mid);
		} else if (state === 0 && ioRoom) {
			ioRoom.emit('event:chats.restore', messages[0]);
		}
	}
};
