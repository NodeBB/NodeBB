"use strict";

var	meta = require('../meta'),
	Messaging = require('../messaging'),
	utils = require('../../public/src/utils'),

	async = require('async'),

	server = require('./'),

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

	// Mark chat as read
	Messaging.markRead(socket.uid, data.touid);
};

SocketModules.chats.getRaw = function(socket, data, callback) {
	if(!data || !data.hasOwnProperty('mid')) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	Messaging.getMessageField(data.mid, 'content', callback);
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

SocketModules.chats.edit = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	Messaging.canEdit(data.mid, socket.uid, function(err, allowed) {
		if (allowed) {
			Messaging.editMessage(data.mid, data.message, callback);
		} else {
			return callback(new Error('[[error:cant-edit-chat-message]]'));
		}
	});
};

SocketModules.chats.delete = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	Messaging.canEdit(data.messageId, socket.uid, function(err, allowed) {
		if (allowed) {
			Messaging.deleteMessage(data.messageId, callback);
		}
	});
}

SocketModules.chats.canMessage = function(socket, toUid, callback) {
	Messaging.canMessage(socket.uid, toUid, function(err, allowed) {
		callback(!allowed ? new Error('[[error:chat-restricted]]') : undefined);
	});
};

SocketModules.chats.markRead = function(socket, touid, callback) {
	Messaging.markRead(socket.uid, touid, function(err) {
		if (err) {
			return callback(err);
		}

		Messaging.pushUnreadCount(socket.uid);
		callback();
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


/* Sounds */
SocketModules.sounds.getSounds = function(socket, data, callback) {
	// Read sounds from local directory
	meta.sounds.getFiles(callback);
};

SocketModules.sounds.getMapping = function(socket, data, callback) {
	meta.sounds.getMapping(callback);
};

SocketModules.sounds.getData = function(socket, data, callback) {
	async.parallel({
		mapping: async.apply(meta.sounds.getMapping),
		files: async.apply(meta.sounds.getFiles)
	}, callback);
};

module.exports = SocketModules;
