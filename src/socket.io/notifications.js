"use strict";

var async = require('async');
var user = require('../user');
var notifications = require('../notifications');
var utils = require('../../public/src/utils');

var SocketNotifs = {};

SocketNotifs.get = function(socket, data, callback) {
	if (data && Array.isArray(data.nids) && socket.uid) {
		user.notifications.getNotifications(data.nids, socket.uid, callback);
	} else {
		user.notifications.get(socket.uid, callback);
	}
};

SocketNotifs.loadMore = function(socket, data, callback) {
	if (!data || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	}
	var start = parseInt(data.after, 10);
	var stop = start + 20;
	user.notifications.getAll(socket.uid, start, stop, function(err, notifications) {
		if (err) {
			return callback(err);
		}
		callback(null, {notifications: notifications, nextStart: stop});
	});
};

SocketNotifs.getCount = function(socket, data, callback) {
	user.notifications.getUnreadCount(socket.uid, callback);
};

SocketNotifs.deleteAll = function(socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	user.notifications.deleteAll(socket.uid, callback);
};

SocketNotifs.markRead = function(socket, nid, callback) {
	notifications.markRead(nid, socket.uid, callback);
};

SocketNotifs.markUnread = function(socket, nid, callback) {
	notifications.markUnread(nid, socket.uid, callback);
};

SocketNotifs.markAllRead = function(socket, data, callback) {
	notifications.markAllRead(socket.uid, callback);
};

SocketNotifs.generatePath = function(socket, nid, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));;
	}
	async.waterfall([
		function (next) {
			notifications.get(nid, next);
		},
		function (notification, next) {
			if (!notification) {
				return next(null, '');
			}
			user.notifications.generateNotificationPaths([notification], socket.uid, next);
		},
		function (notificationsData, next) {
			if (notificationsData && notificationsData.length) {
				next(null, notificationsData[0].path);
			} else {
				next();
			}
		}
	], callback);
};

module.exports = SocketNotifs;
