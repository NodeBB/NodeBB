'use strict';

var async = require('async');

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
		if (!socket.uid) {
			return callback('[[error:invalid-uid]]');
		}

		if (!data || !data.uid) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		var oldUserData;
		async.waterfall([
			function (next) {
				user.getUserFields(data.uid, ['email', 'username'], next);
			},
			function (_oldUserData, next) {
				oldUserData = _oldUserData;
				if (!oldUserData || !oldUserData.username) {
					return next(new Error('[[error-invalid-data]]'));
				}

				if (parseInt(meta.config['username:disableEdit'], 10) === 1) {
					data.username = oldUserData.username;
				}
				SocketUser.isAdminOrSelf(socket, data.uid, next);
			},
			function (next) {
				user.updateProfile(data.uid, data, next);
			},
			function (userData, next) {
				function log(type, eventData) {
					eventData.type = type;
					eventData.uid = socket.uid;
					eventData.targetUid = data.uid;
					eventData.ip = socket.ip;

					events.log(eventData);
				}

				if (userData.email !== oldUserData.email) {
					log('email-change', {oldEmail: oldUserData.email, newEmail: userData.email});
				}

				if (userData.username !== oldUserData.username) {
					log('username-change', {oldUsername: oldUserData.username, newUsername: userData.username});
				}

				next(null, userData);
			}
		], callback);
	};


};