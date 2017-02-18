'use strict';


var user = require('../user');
var topics = require('../topics');

var SocketMeta = {
	rooms: {},
};

SocketMeta.reconnected = function (socket, data, callback) {
	callback = callback || function () {};
	if (socket.uid) {
		topics.pushUnreadCount(socket.uid);
		user.notifications.pushCount(socket.uid);
	}
	callback();
};

/* Rooms */

SocketMeta.rooms.enter = function (socket, data, callback) {
	if (!socket.uid) {
		return callback();
	}

	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (data.enter) {
		data.enter = data.enter.toString();
	}

	if (data.enter && data.enter.startsWith('uid_') && data.enter !== 'uid_' + socket.uid) {
		return callback(new Error('[[error:not-allowed]]'));
	}

	leaveCurrentRoom(socket);

	if (data.enter) {
		socket.join(data.enter);
		socket.currentRoom = data.enter;
	}
	callback();
};

SocketMeta.rooms.leaveCurrent = function (socket, data, callback) {
	if (!socket.uid || !socket.currentRoom) {
		return callback();
	}
	leaveCurrentRoom(socket);
	callback();
};

function leaveCurrentRoom(socket) {
	if (socket.currentRoom) {
		socket.leave(socket.currentRoom);
		socket.currentRoom = '';
	}
}

SocketMeta.getServerTime = function (socket, data, callback) {
	// Returns server time in milliseconds
	callback(null, Date.now());
};

module.exports = SocketMeta;
