'use strict';

var async = require('async');

var db = require('../database');
var user = require('../user');

module.exports = function(Messaging) {

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

	Messaging.addUsersToRoom = function(fromuid, toUids, roomId, callback) {
		async.waterfall([
			function (next) {
				Messaging.isRoomOwner(fromuid, roomId, next);
			},
			function (isOwner, next) {
				if (!isOwner) {
					return next(new Error('[[error:cant-add-users-to-chat-room]]'));
				}
				var now = Date.now();
				var timestamps = toUids.map(function() {
					return now;
				});
				db.sortedSetAdd('chat:room:' + roomId + ':uids', timestamps, toUids, next);
			}
		], callback);
	};

	Messaging.leaveRoom = function(uid, roomId, callback) {
		async.waterfall([
			function (next) {
				db.sortedSetRemove('chat:room:' + roomId + ':uids', uid, next);
			},
			function (next) {
				db.sortedSetRemove('uid:' + uid + ':chat:rooms', roomId, next);
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