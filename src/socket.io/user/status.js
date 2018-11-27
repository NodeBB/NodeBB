'use strict';

var async = require('async');

var user = require('../../user');
var websockets = require('../index');

module.exports = function (SocketUser) {
	SocketUser.checkStatus = function (socket, uid, callback) {
		if (!socket.uid) {
			return callback(new Error('[[error:invalid-uid]]'));
		}
		async.waterfall([
			function (next) {
				user.getUserFields(uid, ['lastonline', 'status'], next);
			},
			function (userData, next) {
				next(null, user.getStatus(userData));
			},
		], callback);
	};

	SocketUser.setStatus = function (socket, status, callback) {
		if (socket.uid <= 0) {
			return callback(new Error('[[error:invalid-uid]]'));
		}

		var allowedStatus = ['online', 'offline', 'dnd', 'away'];
		if (!allowedStatus.includes(status)) {
			return callback(new Error('[[error:invalid-user-status]]'));
		}

		var data = { status: status };
		if (status !== 'offline') {
			data.lastonline = Date.now();
		}

		async.waterfall([
			function (next) {
				user.setUserFields(socket.uid, data, next);
			},
			function (next) {
				if (status !== 'offline') {
					user.updateOnlineUsers(socket.uid, next);
				} else {
					next();
				}
			},
			function (next) {
				var data = {
					uid: socket.uid,
					status: status,
				};
				websockets.server.emit('event:user_status_change', data);
				next(null, data);
			},
		], callback);
	};
};
