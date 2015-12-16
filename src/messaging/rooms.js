'use strict';

var async = require('async');

var db = require('../database');
var user = require('../user');

module.exports = function(Messaging) {

	Messaging.newRoom = function(uid, toUids, callback) {
		var roomId;
		var now = Date.now();
		async.waterfall([
			function (next) {
				db.incrObjectField('global', 'nextChatRoomId', next);
			},
			function (_roomId, next) {
				roomId = _roomId;
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
		db.getSortedSetRange('chat:room:' + roomId + ':uids', 0, 0, function(err, uids) {
			if (err) {
				return callback(err);
			}
			if (!Array.isArray(uids) || !uids.length) {
				return callback(null, false);
			}
			callback(null, parseInt(uids[0], 10) === parseInt(uid, 10));
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
		db.getSortedSetRange('chat:room:' + roomId + ':uids', start, stop, callback);
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

};