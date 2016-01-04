'use strict';

var async = require('async');

var user = require('../../user');
var topics = require('../../topics');

module.exports = function(SocketTopics) {

	SocketTopics.markAsRead = function(socket, tids, callback) {
		if (!Array.isArray(tids) || !socket.uid) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		topics.markAsRead(tids, socket.uid, function(err) {
			if (err) {
				return callback(err);
			}

			Topics.pushUnreadCount(uid);

			for (var i=0; i<tids.length; ++i) {
				Topics.markTopicNotificationsRead(tids[i], uid);
			}
		});
	};

	SocketTopics.markTopicNotificationsRead = function(socket, tid, callback) {
		if (!tid || !socket.uid) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		topics.markTopicNotificationsRead(tid, socket.uid);
	};

	SocketTopics.markAllRead = function(socket, data, callback) {
		topics.markAllRead(socket.uid, function(err) {
			if (err) {
				return callback(err);
			}

			Topics.pushUnreadCount(uid);

			callback();
		});
	};

	SocketTopics.markCategoryTopicsRead = function(socket, cid, callback) {
		topics.getUnreadTids(cid, socket.uid, 0, -1, function(err, tids) {
			if (err) {
				return callback(err);
			}

			SocketTopics.markAsRead(socket, tids, callback);
		});
	};

	SocketTopics.markUnread = function(socket, tid, callback) {
		if (!tid || !socket.uid) {
			return callback();
		}
		topics.markUnread(tid, socket.uid, function(err) {
			if (err) {
				return callback(err);
			}

			topics.pushUnreadCount(socket.uid);
		});
	};

	SocketTopics.markAsUnreadForAll = function(socket, tids, callback) {
		if (!Array.isArray(tids)) {
			return callback(new Error('[[error:invalid-tid]]'));
		}

		if (!socket.uid) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		user.isAdministrator(socket.uid, function(err, isAdmin) {
			if (err) {
				return callback(err);
			}

			async.each(tids, function(tid, next) {
				async.waterfall([
					function(next) {
						topics.exists(tid, next);
					},
					function(exists, next) {
						if (!exists) {
							return next(new Error('[[error:invalid-tid]]'));
						}
						topics.getTopicField(tid, 'cid', next);
					},
					function(cid, next) {
						user.isModerator(socket.uid, cid, next);
					},
					function(isMod, next) {
						if (!isAdmin && !isMod) {
							return next(new Error('[[error:no-privileges]]'));
						}
						topics.markAsUnreadForAll(tid, next);
					},
					function(next) {
						topics.updateRecent(tid, Date.now(), next);
					}
				], next);
			}, function(err) {
				if (err) {
					return callback(err);
				}
				topics.pushUnreadCount(socket.uid);
				callback();
			});
		});
	};
};