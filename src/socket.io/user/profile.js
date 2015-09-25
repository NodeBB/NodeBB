'use strict';

var user = require('../../user');
var meta = require('../../meta');
var events = require('../../events');

module.exports = function(SocketUser) {

	SocketUser.changePassword = function(socket, data, callback) {
		if (!data || !data.uid || data.newPassword.length < meta.config.minimumPasswordLength) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		if (!socket.uid) {
			return callback('[[error:invalid-uid]]');
		}

		user.changePassword(socket.uid, data, function(err) {
			if (err) {
				return callback(err);
			}

			events.log({
				type: 'password-change',
				uid: socket.uid,
				targetUid: data.uid,
				ip: socket.ip
			});
			callback();
		});
	};


	SocketUser.updateProfile = function(socket, data, callback) {
		function update(oldUserData) {
			function done(err, userData) {
				if (err) {
					return callback(err);
				}

				if (userData.email !== oldUserData.email) {
					events.log({
						type: 'email-change',
						uid: socket.uid,
						targetUid: data.uid,
						ip: socket.ip,
						oldEmail: oldUserData.email,
						newEmail: userData.email
					});
				}

				if (userData.username !== oldUserData.username) {
					events.log({
						type: 'username-change',
						uid: socket.uid,
						targetUid: data.uid,
						ip: socket.ip,
						oldUsername: oldUserData.username,
						newUsername: userData.username
					});
				}
				callback(null, userData);
			}

			SocketUser.isAdminOrSelf(socket, data.uid, function(err) {
				if (err) {
					return callback(err);
				}
				user.updateProfile(data.uid, data, done);
			});
		}

		if (!socket.uid) {
			return callback('[[error:invalid-uid]]');
		}

		if (!data || !data.uid) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		user.getUserFields(data.uid, ['email', 'username'], function(err, oldUserData) {
			if (err) {
				return callback(err);
			}

			if (parseInt(meta.config['username:disableEdit'], 10) === 1) {
				data.username = oldUserData.username;
			}

			update(oldUserData, callback);
		});
	};


};