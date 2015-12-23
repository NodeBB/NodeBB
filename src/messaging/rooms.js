'use strict';

var async = require('async');
var validator = require('validator');

var db = require('../database');
var user = require('../user');

module.exports = function(Messaging) {

	Messaging.getRoomData = function(roomId, callback) {
		db.getObject('chat:room:' + roomId, function(err, data) {
			if (err || !data) {
				return callback(err || new Error('[[error:no-chat-room]]'));
			}
			data.roomName = data.roomName || '[[modules:chat.roomname, ' + roomId + ']]';
			if (data.roomName) {
				data.roomName = validator.escape(data.roomName);
			}
			callback(null, data);
		});
	};

	Messaging.newRoom = function(uid, toUids, callback) {
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
					roomId: roomId
				};
				db.setObject('chat:room:' + roomId, room, next);
			},
			function (next) {
				Messaging.addUsersToRoom(uid, [uid].concat(toUids), roomId, next);
			},
			function (next) {
				Messaging.addRoomToUsers(roomId, [uid].concat(toUids), now, next);
			},
			function (next) {
				next(null, roomId);
			}
		], callback);
	};

	Messaging.isUserInRoom = function(uid, roomId, callback) {
		db.isSortedSetMember('chat:room:' + roomId + ':uids', uid, callback);
	};

	Messaging.roomExists = function(roomId, callback) {
		db.exists('chat:room:' + roomId + ':uids', callback);
	};

	Messaging.isRoomOwner = function(uid, roomId, callback) {
		db.getObjectField('chat:room:' + roomId, 'owner', function(err, owner) {
			if (err) {
				return callback(err);
			}

			callback(null, parseInt(uid, 10) === parseInt(owner, 10));
		});
	};

	Messaging.addUsersToRoom = function(uid, uids, roomId, callback) {
		async.waterfall([
			function (next) {
				Messaging.isUserInRoom(uid, roomId, next);
			},
			function (inRoom, next) {
				if (!inRoom) {
					return next(new Error('[[error:cant-add-users-to-chat-room]]'));
				}
				var now = Date.now();
				var timestamps = uids.map(function() {
					return now;
				});
				db.sortedSetAdd('chat:room:' + roomId + ':uids', timestamps, uids, next);
			}
		], callback);
	};

	Messaging.removeUsersFromRoom = function(uid, uids, roomId, callback) {
		async.waterfall([
			function (next) {
				Messaging.isRoomOwner(uid, roomId, next);
			},
			function (isOwner, next) {
				if (!isOwner) {
					return next(new Error('[[error:cant-add-users-to-chat-room]]'));
				}
				db.sortedSetRemove('chat:room:' + roomId + ':uids', uids, next);
			},
			function (next) {
				var keys = uids.map(function(uid) {
					return 'uid:' + uid + ':chat:rooms';
				});
				db.sortedSetsRemove(keys, roomId, next);
			}
		], callback);
	};

	Messaging.getUidsInRoom = function(roomId, start, stop, callback) {
		db.getSortedSetRevRange('chat:room:' + roomId + ':uids', start, stop, callback);
	};

	Messaging.getUsersInRoom = function(roomId, start, stop, callback) {
		async.waterfall([
			function (next) {
				Messaging.getUidsInRoom(roomId, start, stop, next);
			},
			function (uids, next) {
				user.getUsersFields(uids, ['username', 'uid', 'picture', 'status'], next);
			}
		], callback);
	};

	Messaging.renameRoom = function(uid, roomId, newName, callback) {
		if (!newName) {
			return callback(new Error('[[error:invalid-name]]'));
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
			}
		], callback);
	};

};