'use strict';

var async = require('async');
var validator = require('validator');

var db = require('../database');
var meta = require('../meta');
var notifications = require('../notifications');
var plugins = require('../plugins');
var Messaging = require('../messaging');
var utils = require('../utils');
var server = require('./');
var user = require('../user');
var privileges = require('../privileges');

var SocketModules = module.exports;

SocketModules.chats = {};
SocketModules.sounds = {};
SocketModules.settings = {};

/* Chat */

SocketModules.chats.getRaw = function (socket, data, callback) {
	if (!data || !data.hasOwnProperty('mid')) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	async.waterfall([
		function (next) {
			Messaging.getMessageField(data.mid, 'roomId', next);
		},
		function (roomId, next) {
			async.parallel({
				isAdmin: function (next) {
					user.isAdministrator(socket.uid, next);
				},
				hasMessage: function (next) {
					db.isSortedSetMember('uid:' + socket.uid + ':chat:room:' + roomId + ':mids', data.mid, next);
				},
				inRoom: function (next) {
					Messaging.isUserInRoom(socket.uid, roomId, next);
				},
			}, next);
		},
		function (results, next) {
			if (!results.isAdmin && (!results.inRoom || !results.hasMessage)) {
				return next(new Error('[[error:not-allowed]]'));
			}

			Messaging.getMessageField(data.mid, 'content', next);
		},
	], callback);
};

SocketModules.chats.isDnD = function (socket, uid, callback) {
	async.waterfall([
		function (next) {
			db.getObjectField('user:' + uid, 'status', next);
		},
		function (status, next) {
			next(null, status === 'dnd');
		},
	], callback);
};

SocketModules.chats.newRoom = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (rateLimitExceeded(socket)) {
		return callback(new Error('[[error:too-many-messages]]'));
	}

	async.waterfall([
		function (next) {
			privileges.global.can('chat', socket.uid, next);
		},
		function (canChat, next) {
			if (!canChat) {
				return next(new Error('[[error:no-privileges]]'));
			}
			Messaging.canMessageUser(socket.uid, data.touid, next);
		},
		function (next) {
			Messaging.newRoom(socket.uid, [data.touid], next);
		},
	], callback);
};

SocketModules.chats.send = function (socket, data, callback) {
	if (!data || !data.roomId || !socket.uid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (rateLimitExceeded(socket)) {
		return callback(new Error('[[error:too-many-messages]]'));
	}

	async.waterfall([
		function (next) {
			privileges.global.can('chat', socket.uid, next);
		},
		function (canChat, next) {
			if (!canChat) {
				return next(new Error('[[error:no-privileges]]'));
			}

			plugins.fireHook('filter:messaging.send', {
				data: data,
				uid: socket.uid,
			}, function (err, results) {
				data = results.data;
				next(err);
			});
		},
		function (next) {
			Messaging.canMessageRoom(socket.uid, data.roomId, next);
		},
		function (next) {
			Messaging.sendMessage({
				uid: socket.uid,
				roomId: data.roomId,
				content: data.message,
				timestamp: Date.now(),
				ip: socket.ip,
			}, next);
		},
		function (message, next) {
			Messaging.notifyUsersInRoom(socket.uid, data.roomId, message);
			user.updateOnlineUsers(socket.uid);
			next(null, message);
		},
	], callback);
};

function rateLimitExceeded(socket) {
	var now = Date.now();
	socket.lastChatMessageTime = socket.lastChatMessageTime || 0;
	var delay = meta.config.hasOwnProperty('chatMessageDelay') ? parseInt(meta.config.chatMessageDelay, 10) : 200;
	if (now - socket.lastChatMessageTime < delay) {
		return true;
	}
	socket.lastChatMessageTime = now;

	return false;
}

SocketModules.chats.loadRoom = function (socket, data, callback) {
	if (!data || !data.roomId) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	Messaging.loadRoom(socket.uid, data, callback);
};

SocketModules.chats.getUsersInRoom = function (socket, data, callback) {
	if (!data || !data.roomId) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.parallel({
		users: async.apply(Messaging.getUsersInRoom, data.roomId, 0, -1),
		isOwner: async.apply(Messaging.isRoomOwner, socket.uid, data.roomId),
	}, function (err, payload) {
		if (err) {
			return callback(err);
		}

		payload.users = payload.users.map((user) => {
			user.canKick = (parseInt(user.uid, 10) !== parseInt(socket.uid, 10)) && payload.isOwner;
			return user;
		});

		callback(null, payload.users);
	});
};

SocketModules.chats.addUserToRoom = function (socket, data, callback) {
	if (!data || !data.roomId || !data.username) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	var uid;
	async.waterfall([
		function (next) {
			privileges.global.can('chat', socket.uid, next);
		},
		function (canChat, next) {
			if (!canChat) {
				return next(new Error('[[error:no-privileges]]'));
			}

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
		function (_uid, next) {
			uid = _uid;
			if (!uid) {
				return next(new Error('[[error:no-user]]'));
			}
			if (socket.uid === parseInt(uid, 10)) {
				return next(new Error('[[error:cant-chat-with-yourself]]'));
			}
			async.parallel({
				settings: async.apply(user.getSettings, uid),
				isAdminOrGlobalMod: async.apply(user.isAdminOrGlobalMod, socket.uid),
				isFollowing: async.apply(user.isFollowing, uid, socket.uid),
			}, next);
		},
		function (results, next) {
			if (results.settings.restrictChat && !results.isAdminOrGlobalMod && !results.isFollowing) {
				return next(new Error('[[error:chat-restricted]]'));
			}

			Messaging.addUsersToRoom(socket.uid, [uid], data.roomId, next);
		},
	], callback);
};

SocketModules.chats.removeUserFromRoom = function (socket, data, callback) {
	if (!data || !data.roomId) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			user.exists(data.uid, next);
		},
		function (exists, next) {
			if (!exists) {
				return next(new Error('[[error:no-user]]'));
			}

			Messaging.removeUsersFromRoom(socket.uid, [data.uid], data.roomId, next);
		},
	], callback);
};

SocketModules.chats.leave = function (socket, roomid, callback) {
	if (!socket.uid || !roomid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	Messaging.leaveRoom([socket.uid], roomid, callback);
};


SocketModules.chats.edit = function (socket, data, callback) {
	if (!data || !data.roomId || !data.message) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			Messaging.canEdit(data.mid, socket.uid, next);
		},
		function (next) {
			Messaging.editMessage(socket.uid, data.mid, data.roomId, data.message, next);
		},
	], callback);
};

SocketModules.chats.delete = function (socket, data, callback) {
	if (!data || !data.roomId || !data.messageId) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			Messaging.canDelete(data.messageId, socket.uid, next);
		},
		function (next) {
			Messaging.deleteMessage(data.messageId, data.roomId, next);
		},
	], callback);
};

SocketModules.chats.restore = function (socket, data, callback) {
	if (!data || !data.roomId || !data.messageId) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			Messaging.canDelete(data.messageId, socket.uid, next);
		},
		function (next) {
			Messaging.restoreMessage(data.messageId, data.roomId, next);
		},
	], callback);
};

SocketModules.chats.canMessage = function (socket, roomId, callback) {
	Messaging.canMessageRoom(socket.uid, roomId, callback);
};

SocketModules.chats.markRead = function (socket, roomId, callback) {
	if (!socket.uid || !roomId) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	async.waterfall([
		function (next) {
			async.parallel({
				uidsInRoom: async.apply(Messaging.getUidsInRoom, roomId, 0, -1),
				markRead: async.apply(Messaging.markRead, socket.uid, roomId),
			}, next);
		},
		function (results, next) {
			Messaging.pushUnreadCount(socket.uid);
			server.in('uid_' + socket.uid).emit('event:chats.markedAsRead', { roomId: roomId });

			if (results.uidsInRoom.indexOf(socket.uid.toString()) === -1) {
				return callback();
			}

			// Mark notification read
			var nids = results.uidsInRoom.filter(function (uid) {
				return parseInt(uid, 10) !== socket.uid;
			}).map(function (uid) {
				return 'chat_' + uid + '_' + roomId;
			});

			notifications.markReadMultiple(nids, socket.uid, function () {
				user.notifications.pushCount(socket.uid);
			});

			next();
		},
	], callback);
};

SocketModules.chats.markAllRead = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			Messaging.markAllRead(socket.uid, next);
		},
		function (next) {
			Messaging.pushUnreadCount(socket.uid);
			next();
		},
	], callback);
};

SocketModules.chats.renameRoom = function (socket, data, callback) {
	if (!data || !data.roomId || !data.newName) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			Messaging.renameRoom(socket.uid, data.roomId, data.newName, next);
		},
		function (next) {
			Messaging.getUidsInRoom(data.roomId, 0, -1, next);
		},
		function (uids, next) {
			var eventData = { roomId: data.roomId, newName: validator.escape(String(data.newName)) };
			uids.forEach(function (uid) {
				server.in('uid_' + uid).emit('event:chats.roomRename', eventData);
			});
			next();
		},
	], callback);
};

SocketModules.chats.getRecentChats = function (socket, data, callback) {
	if (!data || !utils.isNumber(data.after) || !utils.isNumber(data.uid)) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	var start = parseInt(data.after, 10);
	var stop = start + 9;
	Messaging.getRecentChats(socket.uid, data.uid, start, stop, callback);
};

SocketModules.chats.hasPrivateChat = function (socket, uid, callback) {
	if (!socket.uid || !uid) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	Messaging.hasPrivateChat(socket.uid, uid, callback);
};

SocketModules.chats.getMessages = function (socket, data, callback) {
	if (!socket.uid || !data || !data.uid || !data.roomId) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var params = {
		callerUid: socket.uid,
		uid: data.uid,
		roomId: data.roomId,
		start: parseInt(data.start, 10) || 0,
		count: 50,
	};

	Messaging.getMessages(params, callback);
};

SocketModules.chats.getIP = function (socket, mid, callback) {
	async.waterfall([
		function (next) {
			user.isAdminOrGlobalMod(socket.uid, next);
		},
		function (allowed, next) {
			if (!allowed) {
				return next(new Error('[[error:no-privilege]]'));
			}
			Messaging.getMessageField(mid, 'ip', next);
		},
	], callback);
};

/* Sounds */
SocketModules.sounds.getUserSoundMap = function getUserSoundMap(socket, data, callback) {
	meta.sounds.getUserSoundMap(socket.uid, callback);
};
