'use strict';

var user = require('../../user');
var websockets = require('../index');

module.exports = function(SocketUser) {
	SocketUser.checkStatus = function(socket, uid, callback) {
		if (!socket.uid) {
			return callback('[[error:invalid-uid]]');
		}
		var online = websockets.isUserOnline(uid);
		if (!online) {
			return callback(null, 'offline');
		}
		user.getUserField(uid, 'status', function(err, status) {
			if (err) {
				return callback(err);
			}
			status = status || 'online';
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
			websockets.server.sockets.emit('event:user_status_change', data);
			callback(null, data);
		});
	};
};