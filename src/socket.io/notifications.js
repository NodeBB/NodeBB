'use strict';

var user = require('../user');
var notifications = require('../notifications');

var SocketNotifs = module.exports;

SocketNotifs.get = function (socket, data, callback) {
	if (data && Array.isArray(data.nids) && socket.uid) {
		user.notifications.getNotifications(data.nids, socket.uid, callback);
	} else {
		user.notifications.get(socket.uid, callback);
	}
};

SocketNotifs.getCount = function (socket, data, callback) {
	user.notifications.getUnreadCount(socket.uid, callback);
};

SocketNotifs.deleteAll = function (socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	user.notifications.deleteAll(socket.uid, callback);
};

SocketNotifs.markRead = function (socket, nid, callback) {
	notifications.markRead(nid, socket.uid, callback);
};

SocketNotifs.markUnread = function (socket, nid, callback) {
	notifications.markUnread(nid, socket.uid, callback);
};

SocketNotifs.markAllRead = function (socket, data, callback) {
	notifications.markAllRead(socket.uid, callback);
};
