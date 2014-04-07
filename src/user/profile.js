
'use strict';

var bcrypt = require('bcryptjs'),
	async = require('async'),
	validator = require('validator'),
	S = require('string'),

	utils = require('./../../public/src/utils'),
	meta = require('./../meta'),
	events = require('./../events'),
	db = require('./../database');

module.exports = function(User) {

	User.updateProfile = function(uid, data, callback) {
		var fields = ['username', 'email', 'fullname', 'website', 'location', 'birthday', 'signature'];

		function isSignatureValid(next) {
			if (data.signature !== undefined && data.signature.length > meta.config.maximumSignatureLength) {
				next(new Error('Signature can\'t be longer than ' + meta.config.maximumSignatureLength + ' characters!'));
			} else {
				next();
			}
		}

		function isEmailAvailable(next) {
			if (!data.email) {
				return next();
			}

			User.getUserField(uid, 'email', function(err, email) {
				if(email === data.email) {
					return next();
				}

				User.email.available(data.email, function(err, available) {
					if (err) {
						return next(err);
					}

					next(!available ? new Error('Email not available!') : null);

				});
			});
		}

		function isUsernameAvailable(next) {
			User.getUserFields(uid, ['username', 'userslug'], function(err, userData) {

				var userslug = utils.slugify(data.username);

				if(userslug === userData.userslug) {
					return next();
				}

				if(!utils.isUserNameValid(data.username) || !userslug) {
					return next(new Error('Invalid Username!'));
				}

				User.exists(userslug, function(err, exists) {
					if(err) {
						return next(err);
					}

					next(exists ? new Error('Username not available!') : null);
				});
			});
		}

		async.series([isSignatureValid, isEmailAvailable, isUsernameAvailable], function(err, results) {
			if (err) {
				return callback(err);
			}

			async.each(fields, updateField, function(err) {
				if (err) {
					return callback(err);
				}

				User.getUserFields(uid, ['userslug', 'picture', 'gravatarpicture'], callback);
			});
		});

		function updateField(field, next) {
			if (!(data[field] !== undefined && typeof data[field] === 'string')) {
				return next();
			}

			data[field] = data[field].trim();
			data[field] = validator.escape(data[field]);

			if (field === 'email') {
				return updateEmail(uid, data.email, next);
			} else if (field === 'username') {
				return updateUsername(uid, data.username, next);
			} else if (field === 'signature') {
				data[field] = S(data[field]).stripTags().s;
			} else if (field === 'website') {
				if(data[field].substr(0, 7) !== 'http://' && data[field].substr(0, 8) !== 'https://') {
					data[field] = 'http://' + data[field];
				}
			}

			User.setUserField(uid, field, data[field]);

			next();
		}
	};

	function updateEmail(uid, newEmail, callback) {
		User.getUserFields(uid, ['email', 'picture', 'uploadedpicture'], function(err, userData) {
			if (err) {
				return callback(err);
			}

			if(userData.email === newEmail) {
				return callback();
			}

			db.deleteObjectField('email:uid', userData.email, function(err) {
				if (err) {
					return callback(err);
				}

				events.logEmailChange(uid, userData.email, newEmail);

				var gravatarpicture = User.createGravatarURLFromEmail(newEmail);
				async.parallel([
					function(next) {
						User.setUserField(uid, 'gravatarpicture', gravatarpicture, next);
					},
					function(next) {
						db.setObjectField('email:uid', newEmail, uid, next);
					},
					function(next) {
						User.setUserField(uid, 'email', newEmail, next);
					},
					function(next) {
						if (userData.picture !== userData.uploadedpicture) {
							User.setUserField(uid, 'picture', gravatarpicture, next);
						}
					},
				], callback);
			});
		});
	}

	function updateUsername(uid, newUsername, callback) {
		User.getUserFields(uid, ['username', 'userslug'], function(err, userData) {
			function update(field, object, value, callback) {
				async.parallel([
					function(next) {
						User.setUserField(uid, field, value, next);
					},
					function(next) {
						db.setObjectField(object, value, uid, next);
					}
				], callback);
			}

			if (err) {
				return callback(err);
			}
			var userslug = utils.slugify(newUsername);

			async.parallel([
				function(next) {
					if (newUsername === userData.username) {
						return next();
					}

					db.deleteObjectField('username:uid', userData.username, function(err) {
						if (err) {
							return next(err);
						}
						events.logUsernameChange(uid, userData.username, newUsername);
						update('username', 'username:uid', newUsername, next);
					});
				},
				function(next) {
					if (userslug === userData.userslug) {
						return next();
					}

					db.deleteObjectField('userslug:uid', userData.userslug, function(err) {
						if (err) {
							return next(err);
						}
						update('userslug', 'userslug:uid', userslug, next);
					});
				}
			], callback);
		});
	}

	User.changePassword = function(uid, data, callback) {
		if(!data || !data.uid) {
			return callback(new Error('invalid-uid'));
		}

		function hashAndSetPassword(callback) {
			User.hashPassword(data.newPassword, function(err, hash) {
				if(err) {
					return callback(err);
				}

				User.setUserField(data.uid, 'password', hash, function(err) {
					if(err) {
						return callback(err);
					}

					if(parseInt(uid, 10) === parseInt(data.uid, 10)) {
						events.logPasswordChange(data.uid);
					} else {
						events.logAdminChangeUserPassword(uid, data.uid);
					}

					callback();
				});
			});
		}

		if (!utils.isPasswordValid(data.newPassword)) {
			return callback(new Error('[[user:change_password_error]]'));
		}

		if(parseInt(uid, 10) !== parseInt(data.uid, 10)) {
			User.isAdministrator(uid, function(err, isAdmin) {
				if(err || !isAdmin) {
					return callback(err || new Error('[[user:change_password_error_privileges'));
				}

				hashAndSetPassword(callback);
			});
		} else {
			User.getUserField(uid, 'password', function(err, currentPassword) {
				if(err) {
					return callback(err);
				}

				if (!currentPassword) {
					return hashAndSetPassword(callback);
				}

				bcrypt.compare(data.currentPassword, currentPassword, function(err, res) {
					if (err || !res) {
						return callback(err || new Error('[[user:change_password_error_wrong_current]]'));
					}
					hashAndSetPassword(callback);
				});
			});
		}
	};

};