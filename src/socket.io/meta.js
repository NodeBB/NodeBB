'use strict';

var meta = require('../meta'),
	user = require('../user'),
	topics = require('../topics'),
	emitter = require('../emitter'),

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
		socket.join(data.enter);
		socket.currentRoom = data.enter;
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
		socket.leave(socket.currentRoom);
		socket.currentRoom = '';
	}
}



module.exports = SocketMeta;
