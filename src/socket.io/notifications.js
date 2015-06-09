"use strict";

var	user = require('../user'),
	notifications = require('../notifications'),
	SocketNotifs = {};

SocketNotifs.get = function(socket, data, callback) {
	user.notifications.get(socket.uid, callback);
};

SocketNotifs.getCount = function(socket, data, callback) {
	user.notifications.getUnreadCount(socket.uid, callback);
};

SocketNotifs.deleteAll = function(socket, data, callback) {
	if (!socket.uid) {
		return;
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

module.exports = SocketNotifs;
