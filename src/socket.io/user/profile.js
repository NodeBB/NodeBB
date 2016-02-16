'use strict';

var async = require('async');

var user = require('../../user');
var meta = require('../../meta');
var events = require('../../events');

module.exports = function(SocketUser) {

	SocketUser.changeUsernameEmail = function(socket, data, callback) {
		if (!data || !data.uid || !socket.uid) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function (next) {
				isAdminOrSelfAndPasswordMatch(socket.uid, data, next);
			},
			function (next) {
				SocketUser.updateProfile(socket, data, next);
			}
		], callback);
	};

	SocketUser.updateCover = function(socket, data, callback) {
		if (!socket.uid) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		user.isAdministrator(socket.uid, function(err, isAdmin) {
			if (!isAdmin && data.uid !== socket.uid) {
				return callback(new Error('[[error:no-privileges]]'));
			}

			user.updateCoverPicture(data, callback);
		});
	};

	SocketUser.removeCover = function(socket, data, callback) {
		if (!socket.uid) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		user.isAdminOrSelf(socket.uid, data.uid, function(err) {
			if (err) {
				return callback(err);
			}
			user.removeCoverPicture(data, callback);
		});
	};

	function isAdminOrSelfAndPasswordMatch(uid, data, callback) {
		async.parallel({
			isAdmin: async.apply(user.isAdministrator, uid),
			hasPassword: async.apply(user.hasPassword, data.uid),
			passwordMatch: function(next) {
				if (data.password) {
					user.isPasswordCorrect(data.uid, data.password, next);
				} else {
					next(null, false);
				}
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}
			var self = parseInt(uid, 10) === parseInt(data.uid, 10);

			if (!results.isAdmin && !self) {
				return callback(new Error('[[error:no-privileges]]'));
			}

			if (self && results.hasPassword && !results.passwordMatch) {
				return callback(new Error('[[error:invalid-password]]'));
			}

			callback();
		});
	}

	SocketUser.changePassword = function(socket, data, callback) {
		if (!data || !data.uid) {
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
					return next(new Error('[[error:invalid-data]]'));
				}

				user.isAdminOrGlobalMod(socket.uid, next);
			},
			function(isAdminOrGlobalMod, next) {
				if (!isAdminOrGlobalMod && socket.uid !== parseInt(data.uid, 10)) {
					return next(new Error('[[error:no-privileges]]'));
				}

				if (!isAdminOrGlobalMod && parseInt(meta.config['username:disableEdit'], 10) === 1) {
					data.username = oldUserData.username;
				}

				if (!isAdminOrGlobalMod && parseInt(meta.config['email:disableEdit'], 10) === 1) {
					data.email = oldUserData.email;
				}

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