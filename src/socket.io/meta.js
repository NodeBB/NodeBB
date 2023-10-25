'use strict';

const os = require('os');

const user = require('../user');
const meta = require('../meta');
const topics = require('../topics');

const SocketMeta = module.exports;
SocketMeta.rooms = {};

SocketMeta.reconnected = function (socket, data, callback) {
	callback = callback || function () {};
	if (socket.uid) {
		topics.pushUnreadCount(socket.uid);
		user.notifications.pushCount(socket.uid);
	}
	callback(null, {
		'cache-buster': meta.config['cache-buster'],
		hostname: os.hostname(),
	});
};

/* Rooms */

SocketMeta.rooms.enter = async function (socket, data) {
	if (!socket.uid) {
		return;
	}

	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	if (data.enter) {
		data.enter = data.enter.toString();
	}

	if (data.enter && data.enter.startsWith('uid_') && data.enter !== `uid_${socket.uid}`) {
		throw new Error('[[error:not-allowed]]');
	}

	if (data.enter && data.enter.startsWith('chat_')) {
		throw new Error('[[error:not-allowed]]');
	}

	leaveCurrentRoom(socket);

	if (data.enter) {
		socket.join(data.enter);
		socket.currentRoom = data.enter;
	}
};

SocketMeta.rooms.leaveCurrent = async function (socket) {
	if (!socket.uid || !socket.currentRoom) {
		return;
	}
	leaveCurrentRoom(socket);
};

function leaveCurrentRoom(socket) {
	if (socket.currentRoom) {
		socket.leave(socket.currentRoom);
		socket.currentRoom = '';
	}
}

require('../promisify')(SocketMeta);
