'use strict';

const user = require('../../user');
const websockets = require('../index');

module.exports = function (SocketUser) {
	SocketUser.checkStatus = async function (socket, uid) {
		if (!socket.uid) {
			throw new Error('[[error:invalid-uid]]');
		}
		const userData = await user.getUserFields(uid, ['lastonline', 'status']);
		return user.getStatus(userData);
	};

	SocketUser.setStatus = async function (socket, status) {
		if (socket.uid <= 0) {
			throw new Error('[[error:invalid-uid]]');
		}

		const allowedStatus = ['online', 'offline', 'dnd', 'away'];
		if (!allowedStatus.includes(status)) {
			throw new Error('[[error:invalid-user-status]]');
		}

		const userData = { status: status };
		if (status !== 'offline') {
			userData.lastonline = Date.now();
		}
		await user.setUserFields(socket.uid, userData);
		if (status !== 'offline') {
			await user.updateOnlineUsers(socket.uid);
		}
		const eventData = {
			uid: socket.uid,
			status: status,
		};
		websockets.server.emit('event:user_status_change', eventData);
		return eventData;
	};
};
