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

		const [uids, messages] = await Promise.all([
			Messaging.getUidsInRoom(roomId, 0, -1),
			Messaging.getMessagesData([mid], uid, roomId, true),
		]);

		uids.forEach(function (_uid) {
			if (parseInt(_uid, 10) !== parseInt(uid, 10)) {
				if (state === 1) {
					sockets.in(`uid_${_uid}`).emit('event:chats.delete', mid);
				} else if (state === 0) {
					sockets.in(`uid_${_uid}`).emit('event:chats.restore', messages[0]);
				}
			}
		});
	}
};
