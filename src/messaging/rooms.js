'use strict';

var async = require('async');

var db = require('../database');

module.exports = function(Messaging) {

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

	Messaging.getUidsInRoom = function(roomId, start, stop, callback) {
		db.getSortedSetRange('chat:room:' + roomId + ':uids', start, stop, callback);
	};
};