'use strict';

var	validator = require('validator'),

	meta = require('../meta'),
	user = require('../user'),
	topics = require('../topics'),
	emitter = require('../emitter'),
	rooms = require('./rooms'),

	websockets = require('./'),

	SocketMeta = {
		rooms: {}
	};

SocketMeta.reconnected = function(socket, data, callback) {
	if (socket.uid) {
		topics.pushUnreadCount(socket.uid);
		user.notifications.pushCount(socket.uid);
	}
};

emitter.on('nodebb:ready', function() {
	websockets.server.emit('event:nodebb.ready', {
		'cache-buster': meta.config['cache-buster']
	});
});


/* Rooms */

SocketMeta.rooms.enter = function(socket, data, callback) {
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
		rooms.enter(socket, data.enter);
		socket.currentRoom = data.enter;
		// if (data.enter.indexOf('topic') !== -1) {
		// 	data.uid = socket.uid;
		// 	data.picture = validator.escape(data.picture);
		// 	data.username = validator.escape(data.username);
		// 	data.userslug = validator.escape(data.userslug);

		// 	websockets.in(data.enter).emit('event:user_enter', data);
		// }
	}
	callback();
};

SocketMeta.rooms.leaveCurrent = function(socket, data, callback) {
	if (!socket.uid || !socket.currentRoom) {
		return callback();
	}
	leaveCurrentRoom(socket);
	callback();
};

function leaveCurrentRoom(socket) {
	if (socket.currentRoom) {
		rooms.leave(socket, socket.currentRoom);
		// if (socket.currentRoom.indexOf('topic') !== -1) {
		// 	websockets.in(socket.currentRoom).emit('event:user_leave', socket.uid);
		// }
		socket.currentRoom = '';
	}
}



module.exports = SocketMeta;
