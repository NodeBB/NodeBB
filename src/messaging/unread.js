'use strict';

var async = require('async');

var db = require('../database');
var sockets = require('../socket.io');

module.exports = function (Messaging) {
	Messaging.getUnreadCount = function (uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, 0);
		}
		db.sortedSetCard('uid:' + uid + ':chat:rooms:unread', callback);
	};

	Messaging.pushUnreadCount = function (uid) {
		if (!parseInt(uid, 10)) {
			return;
		}
		Messaging.getUnreadCount(uid, function (err, unreadCount) {
			if (err) {
				return;
			}
			sockets.in('uid_' + uid).emit('event:unread.updateChatCount', unreadCount);
		});
	};

	Messaging.markRead = function (uid, roomId, callback) {
		db.sortedSetRemove('uid:' + uid + ':chat:rooms:unread', roomId, callback);
	};

	Messaging.markAllRead = function (uid, callback) {
		db.delete('uid:' + uid + ':chat:rooms:unread', callback);
	};

	Messaging.markUnread = function (uids, roomId, callback) {
		async.waterfall([
			function (next) {
				Messaging.roomExists(roomId, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:chat-room-does-not-exist]]'));
				}
				var keys = uids.map(function (uid) {
					return 'uid:' + uid + ':chat:rooms:unread';
				});

				db.sortedSetsAdd(keys, Date.now(), roomId, next);
			},
		], callback);
	};
};
