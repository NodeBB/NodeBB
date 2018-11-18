'use strict';

var async = require('async');

var user = require('../../user');
var topics = require('../../topics');

module.exports = function (SocketTopics) {
	SocketTopics.markAsRead = function (socket, tids, callback) {
		if (!Array.isArray(tids) || socket.uid <= 0) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		async.waterfall([
			function (next) {
				topics.markAsRead(tids, socket.uid, next);
			},
			function (hasMarked, next) {
				if (hasMarked) {
					topics.pushUnreadCount(socket.uid);

					topics.markTopicNotificationsRead(tids, socket.uid);
				}
				next();
			},
		], callback);
	};

	SocketTopics.markTopicNotificationsRead = function (socket, tids, callback) {
		if (!Array.isArray(tids) || !socket.uid) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		topics.markTopicNotificationsRead(tids, socket.uid, callback);
	};

	SocketTopics.markAllRead = function (socket, data, callback) {
		if (socket.uid <= 0) {
			return callback(new Error('[[error:invalid-uid]]'));
		}
		async.waterfall([
			function (next) {
				topics.markAllRead(socket.uid, next);
			},
			function (next) {
				topics.pushUnreadCount(socket.uid);
				next();
			},
		], callback);
	};

	SocketTopics.markCategoryTopicsRead = function (socket, cid, callback) {
		async.waterfall([
			function (next) {
				topics.getUnreadTids({ cid: cid, uid: socket.uid, filter: '' }, next);
			},
			function (tids, next) {
				SocketTopics.markAsRead(socket, tids, next);
			},
		], callback);
	};

	SocketTopics.markUnread = function (socket, tid, callback) {
		if (!tid || socket.uid <= 0) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		async.waterfall([
			function (next) {
				topics.markUnread(tid, socket.uid, next);
			},
			function (next) {
				topics.pushUnreadCount(socket.uid);
				next();
			},
		], callback);
	};

	SocketTopics.markAsUnreadForAll = function (socket, tids, callback) {
		if (!Array.isArray(tids)) {
			return callback(new Error('[[error:invalid-tid]]'));
		}

		if (socket.uid <= 0) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		async.waterfall([
			function (next) {
				user.isAdministrator(socket.uid, next);
			},
			function (isAdmin, next) {
				async.each(tids, function (tid, next) {
					async.waterfall([
						function (next) {
							topics.exists(tid, next);
						},
						function (exists, next) {
							if (!exists) {
								return next(new Error('[[error:no-topic]]'));
							}
							topics.getTopicField(tid, 'cid', next);
						},
						function (cid, next) {
							user.isModerator(socket.uid, cid, next);
						},
						function (isMod, next) {
							if (!isAdmin && !isMod) {
								return next(new Error('[[error:no-privileges]]'));
							}
							topics.markAsUnreadForAll(tid, next);
						},
						function (next) {
							topics.updateRecent(tid, Date.now(), next);
						},
					], next);
				}, next);
			},
			function (next) {
				topics.pushUnreadCount(socket.uid);
				next();
			},
		], callback);
	};
};
