"use strict";

var	meta = require('../meta'),
	Messaging = require('../messaging'),
	utils = require('../../public/src/utils'),

	async = require('async'),

	server = require('./'),
	rooms = require('./rooms'),

	SocketModules = {
		chats: {},
		sounds: {},
		settings: {}
	};

/* Chat */

SocketModules.chats.get = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	Messaging.getMessages({
		fromuid: socket.uid,
		touid: data.touid,
		since: data.since,
		isNew: false
	}, callback);
};

SocketModules.chats.send = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var now = Date.now(),
		touid = parseInt(data.touid, 10);

	// Websocket rate limiting
	socket.lastChatMessageTime = socket.lastChatMessageTime || 0;
	if (now - socket.lastChatMessageTime < 200) {
		return callback(new Error('[[error:too-many-messages]]'));
	} else {
		socket.lastChatMessageTime = now;
	}

	Messaging.canMessage(socket.uid, touid, function(err, allowed) {
		if (err || !allowed) {
			return callback(err || new Error('[[error:chat-restricted]]'));
		}

		Messaging.addMessage(socket.uid, touid, data.message, function(err, message) {
			if (err) {
				return callback(err);
			}

			Messaging.notifyUser(socket.uid, touid, message);

			callback();
		});
	});
};

SocketModules.chats.canMessage = function(socket, toUid, callback) {
	Messaging.canMessage(socket.uid, toUid, function(err, allowed) {
		callback(!allowed ? new Error('[[error:chat-restricted]]') : undefined);
	});
};

SocketModules.chats.markRead = function(socket, touid, callback) {
	Messaging.markRead(socket.uid, touid, function(err) {
		if (!err) {
			Messaging.pushUnreadCount(socket.uid);
		}
	});
};

SocketModules.chats.userStartTyping = function(socket, data, callback) {
	sendTypingNotification('event:chats.userStartTyping', socket, data, callback);
};

SocketModules.chats.userStopTyping = function(socket, data, callback) {
	sendTypingNotification('event:chats.userStopTyping', socket, data, callback);
};

function sendTypingNotification(event, socket, data, callback) {
	if (!socket.uid || !data) {
		return;
	}
	server.in('uid_' + data.touid).emit(event, data.fromUid);
}

SocketModules.chats.getRecentChats = function(socket, data, callback) {
	if (!data || !utils.isNumber(data.after)) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	var start = parseInt(data.after, 10),
		stop = start + 9;

	Messaging.getRecentChats(socket.uid, start, stop, callback);
};

SocketModules.chats.sync = function(socket, data, callback) {
	var chats = [],
		uids = [],
		socketIds = rooms.clients('uid_' + socket.uid);

	rooms.broadcast(socket, 'uid_' + socket.uid, 'query:chats.sync', {}, function(err, sessionData) {
		sessionData.forEach(function(data) {
			data.forEach(function(chat) {
				if (uids.indexOf(chat.uid) === -1) {
					chats.push(chat);
					uids.push(chat.uid);
				}
			});
		});

		callback(err, chats);
	});
};

SocketModules.chats.open = function(socket, data, callback) {
	rooms.broadcast(socket, 'uid_' + socket.uid, 'event:chats.open', data);
};

SocketModules.chats.close = function(socket, data, callback) {
	rooms.broadcast(socket, 'uid_' + socket.uid, 'event:chats.close', data);
};

SocketModules.chats.toggleNew = function(socket, data, callback) {
	rooms.broadcast(socket, 'uid_' + socket.uid, 'event:chats.toggleNew', data);
};


/* Sounds */
SocketModules.sounds.getSounds = function(socket, data, callback) {
	// Read sounds from local directory
	meta.sounds.getFiles(callback);
};

SocketModules.sounds.getMapping = function(socket, data, callback) {
	meta.sounds.getMapping(callback);
};

module.exports = SocketModules;
