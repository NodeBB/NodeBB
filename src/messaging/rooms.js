'use strict';

var async = require('async');
var validator = require('validator');

var db = require('../database');
var user = require('../user');
var plugins = require('../plugins');
var privileges = require('../privileges');
var meta = require('../meta');

module.exports = function (Messaging) {
	Messaging.getRoomData = function (roomId, callback) {
		async.waterfall([
			function (next) {
				db.getObject('chat:room:' + roomId, next);
			},
			function (data, next) {
				if (!data) {
					return callback(new Error('[[error:no-chat-room]]'));
				}
				modifyRoomData([data]);
				next(null, data);
			},
		], callback);
	};

	Messaging.getRoomsData = function (roomIds, callback) {
		var keys = roomIds.map(function (roomId) {
			return 'chat:room:' + roomId;
		});
		async.waterfall([
			function (next) {
				db.getObjects(keys, next);
			},
			function (roomData, next) {
				modifyRoomData(roomData);
				next(null, roomData);
			},
		], callback);
	};

	function modifyRoomData(rooms) {
		rooms.forEach(function (data) {
			if (data) {
				data.roomName = data.roomName || '';
				data.roomName = validator.escape(String(data.roomName));
				if (data.hasOwnProperty('groupChat')) {
					data.groupChat = parseInt(data.groupChat, 10) === 1;
				}
			}
		});
	}

	Messaging.newRoom = function (uid, toUids, callback) {
		var roomId;
		var now = Date.now();
		async.waterfall([
			function (next) {
				db.incrObjectField('global', 'nextChatRoomId', next);
			},
			function (_roomId, next) {
				roomId = _roomId;
				var room = {
					owner: uid,
					roomId: roomId,
				};
				db.setObject('chat:room:' + roomId, room, next);
			},
			function (next) {
				db.sortedSetAdd('chat:room:' + roomId + ':uids', now, uid, next);
			},
			function (next) {
				Messaging.addUsersToRoom(uid, toUids, roomId, next);
			},
			function (next) {
				Messaging.addRoomToUsers(roomId, [uid].concat(toUids), now, next);
			},
			function (next) {
				next(null, roomId);
			},
		], callback);
	};

	Messaging.isUserInRoom = function (uid, roomId, callback) {
		async.waterfall([
			function (next) {
				db.isSortedSetMember('chat:room:' + roomId + ':uids', uid, next);
			},
			function (inRoom, next) {
				plugins.fireHook('filter:messaging.isUserInRoom', { uid: uid, roomId: roomId, inRoom: inRoom }, next);
			},
			function (data, next) {
				next(null, data.inRoom);
			},
		], callback);
	};

	Messaging.roomExists = function (roomId, callback) {
		db.exists('chat:room:' + roomId + ':uids', callback);
	};

	Messaging.getUserCountInRoom = function (roomId, callback) {
		db.sortedSetCard('chat:room:' + roomId + ':uids', callback);
	};

	Messaging.isRoomOwner = function (uid, roomId, callback) {
		async.waterfall([
			function (next) {
				db.getObjectField('chat:room:' + roomId, 'owner', next);
			},
			function (owner, next) {
				next(null, parseInt(uid, 10) === parseInt(owner, 10));
			},
		], callback);
	};

	Messaging.addUsersToRoom = function (uid, uids, roomId, callback) {
		async.waterfall([
			function (next) {
				Messaging.isUserInRoom(uid, roomId, next);
			},
			function (inRoom, next) {
				if (!inRoom) {
					return next(new Error('[[error:cant-add-users-to-chat-room]]'));
				}
				var now = Date.now();
				var timestamps = uids.map(function () {
					return now;
				});
				db.sortedSetAdd('chat:room:' + roomId + ':uids', timestamps, uids, next);
			},
			function (next) {
				async.parallel({
					userCount: async.apply(db.sortedSetCard, 'chat:room:' + roomId + ':uids'),
					roomData: async.apply(db.getObject, 'chat:room:' + roomId),
				}, next);
			},
			function (results, next) {
				if (!results.roomData.hasOwnProperty('groupChat') && results.userCount > 2) {
					return db.setObjectField('chat:room:' + roomId, 'groupChat', 1, next);
				}
				next();
			},
		], callback);
	};

	Messaging.removeUsersFromRoom = function (uid, uids, roomId, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					isOwner: async.apply(Messaging.isRoomOwner, uid, roomId),
					userCount: async.apply(Messaging.getUserCountInRoom, roomId),
				}, next);
			},
			function (results, next) {
				if (!results.isOwner) {
					return next(new Error('[[error:cant-remove-users-from-chat-room]]'));
				}
				if (results.userCount === 2) {
					return next(new Error('[[error:cant-remove-last-user]]'));
				}
				Messaging.leaveRoom(uids, roomId, next);
			},
		], callback);
	};

	Messaging.leaveRoom = function (uids, roomId, callback) {
		async.waterfall([
			function (next) {
				db.sortedSetRemove('chat:room:' + roomId + ':uids', uids, next);
			},
			function (next) {
				var keys = uids.map(function (uid) {
					return 'uid:' + uid + ':chat:rooms';
				});
				keys = keys.concat(uids.map(function (uid) {
					return 'uid:' + uid + ':chat:rooms:unread';
				}));
				db.sortedSetsRemove(keys, roomId, next);
			},
			function (next) {
				updateOwner(roomId, next);
			},
		], callback);
	};

	Messaging.leaveRooms = function (uid, roomIds, callback) {
		async.waterfall([
			function (next) {
				var roomKeys = roomIds.map(function (roomId) {
					return 'chat:room:' + roomId + ':uids';
				});
				db.sortedSetsRemove(roomKeys, uid, next);
			},
			function (next) {
				db.sortedSetRemove('uid:' + uid + ':chat:rooms', roomIds, next);
			},
			function (next) {
				db.sortedSetRemove('uid:' + uid + ':chat:rooms:unread', roomIds, next);
			},
			function (next) {
				async.eachSeries(roomIds, updateOwner, next);
			},
		], callback);
	};

	function updateOwner(roomId, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRange('chat:room:' + roomId + ':uids', 0, 0, next);
			},
			function (uids, next) {
				var newOwner = uids[0] || 0;
				db.setObjectField('chat:room:' + roomId, 'owner', newOwner, next);
			},
		], callback);
	}

	Messaging.getUidsInRoom = function (roomId, start, stop, callback) {
		db.getSortedSetRevRange('chat:room:' + roomId + ':uids', start, stop, callback);
	};

	Messaging.getUsersInRoom = function (roomId, start, stop, callback) {
		async.waterfall([
			function (next) {
				Messaging.getUidsInRoom(roomId, start, stop, next);
			},
			function (uids, next) {
				user.getUsersFields(uids, ['uid', 'username', 'picture', 'status'], next);
			},
			function (users, next) {
				db.getObjectField('chat:room:' + roomId, 'owner', function (err, ownerId) {
					next(err, users.map(function (user) {
						user.isOwner = parseInt(user.uid, 10) === parseInt(ownerId, 10);
						return user;
					}));
				});
			},
		], callback);
	};

	Messaging.renameRoom = function (uid, roomId, newName, callback) {
		if (!newName) {
			return callback(new Error('[[error:invalid-name]]'));
		}
		newName = newName.trim();
		if (newName.length > 75) {
			return callback(new Error('[[error:chat-room-name-too-long]]'));
		}
		async.waterfall([
			function (next) {
				Messaging.isRoomOwner(uid, roomId, next);
			},
			function (isOwner, next) {
				if (!isOwner) {
					return next(new Error('[[error:no-privileges]]'));
				}
				db.setObjectField('chat:room:' + roomId, 'roomName', newName, next);
			},
			async.apply(plugins.fireHook, 'action:chat.renameRoom', {
				roomId: roomId,
				newName: newName,
			}),
		], callback);
	};

	Messaging.canReply = function (roomId, uid, callback) {
		async.waterfall([
			function (next) {
				db.isSortedSetMember('chat:room:' + roomId + ':uids', uid, next);
			},
			function (inRoom, next) {
				plugins.fireHook('filter:messaging.canReply', { uid: uid, roomId: roomId, inRoom: inRoom, canReply: inRoom }, next);
			},
			function (data, next) {
				next(null, data.canReply);
			},
		], callback);
	};

	Messaging.loadRoom = function (uid, data, callback) {
		async.waterfall([
			function (next) {
				privileges.global.can('chat', uid, next);
			},
			function (canChat, next) {
				if (!canChat) {
					return next(new Error('[[error:no-privileges]]'));
				}

				Messaging.isUserInRoom(uid, data.roomId, next);
			},
			function (inRoom, next) {
				if (!inRoom) {
					return callback(null, null);
				}

				async.parallel({
					roomData: async.apply(Messaging.getRoomData, data.roomId),
					canReply: async.apply(Messaging.canReply, data.roomId, uid),
					users: async.apply(Messaging.getUsersInRoom, data.roomId, 0, -1),
					messages: async.apply(Messaging.getMessages, {
						callerUid: uid,
						uid: data.uid || uid,
						roomId: data.roomId,
						isNew: false,
					}),
					isAdminOrGlobalMod: function (next) {
						user.isAdminOrGlobalMod(uid, next);
					},
				}, next);
			},
			function (results, next) {
				var room = results.roomData;
				room.messages = results.messages;
				room.isOwner = parseInt(room.owner, 10) === parseInt(uid, 10);
				room.users = results.users.filter(function (user) {
					return user && parseInt(user.uid, 10) && parseInt(user.uid, 10) !== uid;
				});
				room.canReply = results.canReply;
				room.groupChat = room.hasOwnProperty('groupChat') ? room.groupChat : results.users.length > 2;
				room.usernames = Messaging.generateUsernames(results.users, uid);
				room.maximumUsersInChatRoom = meta.config.maximumUsersInChatRoom;
				room.maximumChatMessageLength = meta.config.maximumChatMessageLength;
				room.showUserInput = !room.maximumUsersInChatRoom || room.maximumUsersInChatRoom > 2;
				room.isAdminOrGlobalMod = results.isAdminOrGlobalMod;
				next(null, room);
			},
		], callback);
	};
};
