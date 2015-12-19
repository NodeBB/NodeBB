"use strict";

var async = require('async');
var	meta = require('../meta');
var Messaging = require('../messaging');
var utils = require('../../public/src/utils');
var server = require('./');
var user = require('../user');

var SocketModules = {
		chats: {},
		sounds: {},
		settings: {}
	};

/* Chat */

SocketModules.chats.get = function(socket, data, callback) {
	if(!data || !data.roomId) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	Messaging.getMessages({
		uid: socket.uid,
		roomId: data.roomId,
		since: data.since,
		isNew: false
	}, callback);

	Messaging.markRead(socket.uid, data.roomId);
};

SocketModules.chats.getRaw = function(socket, data, callback) {
	if (!data || !data.hasOwnProperty('mid')) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	async.waterfall([
		function (next) {
			Messaging.isUserInRoom(socket.uid, data.roomId, next);
		},
		function (inRoom, next) {
			if (!inRoom) {
				return next(new Error('[[error:not-allowed]]'));
			}
			Messaging.getMessageField(data.mid, 'content', next);
		}
	], callback);
};

SocketModules.chats.newRoom = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	var now = Date.now();
	// Websocket rate limiting
	socket.lastChatMessageTime = socket.lastChatMessageTime || 0;
	if (now - socket.lastChatMessageTime < 200) {
		return callback(new Error('[[error:too-many-messages]]'));
	} else {
		socket.lastChatMessageTime = now;
	}

	Messaging.canMessageUser(socket.uid, data.touid, function(err, allowed) {
		if (err || !allowed) {
			return callback(err || new Error('[[error:chat-restricted]]'));
		}

		Messaging.newRoom(socket.uid, [data.touid], callback);
	});
};

SocketModules.chats.send = function(socket, data, callback) {
	if (!data || !data.roomId) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var now = Date.now();

	// Websocket rate limiting
	socket.lastChatMessageTime = socket.lastChatMessageTime || 0;
	if (now - socket.lastChatMessageTime < 200) {
		return callback(new Error('[[error:too-many-messages]]'));
	} else {
		socket.lastChatMessageTime = now;
	}

	Messaging.canMessageRoom(socket.uid, data.roomId, function(err, allowed) {
		if (err || !allowed) {
			return callback(err || new Error('[[error:chat-restricted]]'));
		}

		Messaging.sendMessage(socket.uid, data.roomId, data.message, now, function(err, message) {
			if (err) {
				return callback(err);
			}

			Messaging.notifyUsersInRoom(socket.uid, data.roomId, message);

			callback();
		});
	});
};

SocketModules.chats.getUsersInRoom = function(socket, data, callback) {
	if (!data || !data.roomId) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			Messaging.isUserInRoom(socket.uid, data.roomId, next);
		},
		function (inRoom, next) {
			if (!inRoom) {
				return next(new Error('[[error:not-allowerd]]'));
			}
			Messaging.getUsersInRoom(data.roomId, 0, -1, next);
		}
	], callback);
};

SocketModules.chats.addUserToRoom = function(socket, data, callback) {
	if (!data || !data.roomId || !data.username) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	async.waterfall([
		function (next) {
			user.getUidByUsername(data.username, next);
		},
		function (uid, next) {
			if (!uid) {
				return next(new Error('[[error:no-user]]'));
			}
			Messaging.addUsersToRoom(socket.uid, [uid], data.roomId, next);
		}
	], callback);
};

SocketModules.chats.removeUserFromRoom = function(socket, data, callback) {
	if (!data || !data.roomId) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	async.waterfall([
		function (next) {
			user.getUidByUsername(data.username, next);
		},
		function (uid, next) {
			if (!uid) {
				return next(new Error('[[error:no-user]]'));
			}

			Messaging.removeUsersFromRoom(socket.uid, [uid], data.roomId, next);
		}
	], callback);
};

SocketModules.chats.edit = function(socket, data, callback) {
	if (!data || !data.roomId) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	Messaging.canEdit(data.mid, socket.uid, function(err, allowed) {
		if (err || !allowed) {
			return callback(err || new Error('[[error:cant-edit-chat-message]]'));
		}

		Messaging.editMessage(socket.uid, data.mid, data.roomId, data.message, callback);
	});
};

SocketModules.chats.delete = function(socket, data, callback) {
	if (!data || !data.roomId || !data.messageId) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	Messaging.canEdit(data.messageId, socket.uid, function(err, allowed) {
		if (err || !allowed) {
			return callback(err || new Error('[[error:cant-delete-chat-message]]'));
		}

		Messaging.deleteMessage(data.messageId, data.roomId, callback);
	});
};

SocketModules.chats.canMessage = function(socket, roomId, callback) {
	Messaging.canMessageRoom(socket.uid, roomId, function(err, allowed) {
		callback(!allowed ? new Error('[[error:chat-restricted]]') : undefined);
	});
};

SocketModules.chats.markRead = function(socket, roomId, callback) {
	Messaging.markRead(socket.uid, roomId, function(err) {
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
	if (!socket.uid || !data || !data.roomId) {
		return;
	}

	Messaging.getUidsInRoom(data.roomId, 0, -1, function(err, uids) {
		if (err) {
			return callback(err);
		}
		uids.forEach(function(uid) {
			if (socket.uid !== parseInt(uid, 10)) {
				server.in('uid_' + uid).emit(event, data.fromUid);
			}
		});
	});
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
