"use strict";

var	user = require('../user'),

	SocketNotifs = {};

SocketNotifs.get = function(socket, data, callback) {
	user.notifications.get(socket.uid, callback);
};

SocketNotifs.getCount = function(socket, data, callback) {
	user.notifications.getUnreadCount(socket.uid, callback);
};

module.exports = SocketNotifs;
