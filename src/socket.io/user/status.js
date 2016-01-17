'use strict';

var user = require('../../user');
var websockets = require('../index');

module.exports = function(SocketUser) {
	SocketUser.checkStatus = function(socket, uid, callback) {
		if (!socket.uid) {
			return callback('[[error:invalid-uid]]');
		}

		user.getUserFields(uid, ['lastonline', 'status'], function(err, userData) {
			if (err) {
				return callback(err);
			}
			var status = user.getStatus(userData);
			callback(null, status);
		});
	};

	SocketUser.setStatus = function(socket, status, callback) {
		if (!socket.uid) {
			return callback(new Error('[[error:invalid-uid]]'));
		}

		var allowedStatus = ['online', 'offline', 'dnd', 'away'];
		if (allowedStatus.indexOf(status) === -1) {
			return callback(new Error('[[error:invalid-user-status]]'));
		}
		user.setUserField(socket.uid, 'status', status, function(err) {
			if (err) {
				return callback(err);
			}
			var data = {
				uid: socket.uid,
				status: status
			};
			websockets.server.emit('event:user_status_change', data);
			callback(null, data);
		});
	};
};