"use strict";

var async = require('async');
var validator = require('validator');

var meta = require('../meta');
var notifications = require('../notifications');
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

	Messaging.canMessageUser(socket.uid, data.touid, function(err) {
		if (err) {
			return callback(err);
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

	async.waterfall([
		function (next) {
			Messaging.canMessageRoom(socket.uid, data.roomId, next);
		},
		function (next) {
			Messaging.sendMessage(socket.uid, data.roomId, data.message, now, next);
		},
		function (message, next) {
			Messaging.notifyUsersInRoom(socket.uid, data.roomId, message);
			user.updateOnlineUsers(socket.uid);
			next();
		}
	], callback);
};

SocketModules.chats.loadRoom = function(socket, data, callback) {
	if (!data || !data.roomId) {
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

			async.parallel({
				roomData: async.apply(Messaging.getRoomData, data.roomId),
				users: async.apply(Messaging.getUsersInRoom, data.roomId, 0, -1)
			}, next);
		},
		function (results, next) {
			results.roomData.users = results.users;
			results.roomData.isOwner = parseInt(results.roomData.owner, 10) === socket.uid;
			results.roomData.maximumUsersInChatRoom = parseInt(meta.config.maximumUsersInChatRoom, 10) || 0;
			results.roomData.showUserInput = !results.roomData.maximumUsersInChatRoom || results.roomData.maximumUsersInChatRoom > 2;
			next(null, results.roomData);
		}
	], callback);
};

SocketModules.chats.addUserToRoom = function(socket, data, callback) {
	if (!data || !data.roomId || !data.username) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	async.waterfall([
		function (next) {
			Messaging.getUserCountInRoom(data.roomId, next);
		},
		function (userCount, next) {
			var maxUsers = parseInt(meta.config.maximumUsersInChatRoom, 10) || 0;
			if (maxUsers && userCount >= maxUsers) {
				return next(new Error('[[error:cant-add-more-users-to-chat-room]]'));
			}
			next();
		},
		function (next) {
			user.getUidByUsername(data.username, next);
		},
		function (uid, next) {
			if (!uid) {
				return next(new Error('[[error:no-user]]'));
			}
			if (socket.uid === parseInt(uid, 10)) {
				return next(new Error('[[error:cant-add-self-to-chat-room]]'));
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

SocketModules.chats.leave = function(socket, roomid, callback) {
	if (!socket.uid || !roomid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	Messaging.leaveRoom([socket.uid], roomid, callback);
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
	Messaging.canMessageRoom(socket.uid, roomId, callback);
};

SocketModules.chats.markRead = function(socket, roomId, callback) {
	async.parallel({
		usersInRoom: async.apply(Messaging.getUidsInRoom, roomId, 0, -1),
		markRead: async.apply(Messaging.markRead, socket.uid, roomId)
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		Messaging.pushUnreadCount(socket.uid);

		// Mark notification read
		var nids = results.usersInRoom.filter(function(uid) {
			return parseInt(uid, 10) !== socket.uid;
		}).map(function(uid) {
			return 'chat_' + uid + '_' + roomId;
		});

		notifications.markReadMultiple(nids, socket.uid, function() {
			user.notifications.pushCount(socket.uid);
		});

		server.in('uid_' + socket.uid).emit('event:chats.markedAsRead', {roomId: roomId});
		callback();
	});
};

SocketModules.chats.markAllRead = function(socket, data, callback) {
	async.waterfall([
		function (next) {
			Messaging.markAllRead(socket.uid, next);
		},
		function (next) {
			Messaging.pushUnreadCount(socket.uid);
			next();
		}
	], callback);
};

SocketModules.chats.renameRoom = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-name]]'));
	}

	async.waterfall([
		function (next) {
			Messaging.renameRoom(socket.uid, data.roomId, data.newName, next);
		},
		function (next) {
			Messaging.getUidsInRoom(data.roomId, 0, -1, next);
		},
		function (uids, next) {
			var eventData = {roomId: data.roomId, newName: validator.escape(data.newName)};
			uids.forEach(function(uid) {
				server.in('uid_' + uid).emit('event:chats.roomRename', eventData);
			});
			next();
		}
	], callback);
};

SocketModules.chats.getRecentChats = function(socket, data, callback) {
	if (!data || !utils.isNumber(data.after)) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	var start = parseInt(data.after, 10),
		stop = start + 9;

	Messaging.getRecentChats(socket.uid, start, stop, callback);
};

SocketModules.chats.hasPrivateChat = function(socket, uid, callback) {
	if (!socket.uid || !uid) {
		return callback(null, new Error('[[error:invalid-data]]'));
	}
	Messaging.hasPrivateChat(socket.uid, uid, callback);
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
