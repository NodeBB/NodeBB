
'use strict';

var async = require('async'),
	validator = require('validator'),
	S = require('string'),

	utils = require('../../public/src/utils'),
	meta = require('../meta'),
	events = require('../events'),
	db = require('../database'),
	Password = require('../password');

module.exports = function(User) {

	User.updateProfile = function(uid, data, callback) {
		var fields = ['username', 'email', 'fullname', 'website', 'location', 'birthday', 'signature'];

		function isSignatureValid(next) {
			if (data.signature !== undefined && data.signature.length > meta.config.maximumSignatureLength) {
				next(new Error('[[error:signature-too-long, ' + meta.config.maximumSignatureLength + ']]'));
			} else {
				next();
			}
		}

		function isEmailAvailable(next) {
			if (!data.email) {
				return next();
			}

			if (!utils.isEmailValid(data.email)) {
				return next(new Error('[[error:invalid-email]]'));
			}

			User.getUserField(uid, 'email', function(err, email) {
				if(email === data.email) {
					return next();
				}

				User.email.available(data.email, function(err, available) {
					if (err) {
						return next(err);
					}

					next(!available ? new Error('[[error:email-taken]]') : null);
				});
			});
		}

		function isUsernameAvailable(next) {
			User.getUserFields(uid, ['username', 'userslug'], function(err, userData) {

				var userslug = utils.slugify(data.username);

				if(userslug === userData.userslug) {
					return next();
				}

				if (data.username.length < meta.config.minimumUsernameLength) {
					return next(new Error('[[error:username-too-short]]'));
				}

				if (data.username.length > meta.config.maximumUsernameLength) {
					return next(new Error('[[error:username-too-long]]'));
				}

				if(!utils.isUserNameValid(data.username) || !userslug) {
					return next(new Error('[[error:invalid-username]]'));
				}

				User.exists(userslug, function(err, exists) {
					if(err) {
						return next(err);
					}

					next(exists ? new Error('[[error:username-taken]]') : null);
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

				User.getUserFields(uid, ['email', 'userslug', 'picture', 'gravatarpicture'], callback);
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

			User.setUserField(uid, field, data[field], next);
		}
	};

	function updateEmail(uid, newEmail, callback) {
		User.getUserFields(uid, ['email', 'picture', 'uploadedpicture'], function(err, userData) {
			if (err) {
				return callback(err);
			}

			userData.email = userData.email || '';

			if (userData.email === newEmail) {
				return callback();
			}

			db.deleteObjectField('email:uid', userData.email.toLowerCase(), function(err) {
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
						db.setObjectField('email:uid', newEmail.toLowerCase(), uid, next);
					},
					function(next) {
						User.setUserField(uid, 'email', newEmail, next);
					},
					function(next) {
						if (parseInt(meta.config.requireEmailConfirmation, 10) === 1) {
							User.email.verify(uid, newEmail);
						}
						User.setUserField(uid, 'email:confirmed', 0, next);
					},
					function(next) {
						if (userData.picture !== userData.uploadedpicture) {
							User.setUserField(uid, 'picture', gravatarpicture, next);
						} else {
							next();
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
			return callback(new Error('[[error:invalid-uid]]'));
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
			db.getObjectField('user:' + uid, 'password', function(err, currentPassword) {
				if(err) {
					return callback(err);
				}

				if (!currentPassword) {
					return hashAndSetPassword(callback);
				}

				Password.compare(data.currentPassword, currentPassword, function(err, res) {
					if (err || !res) {
						return callback(err || new Error('[[user:change_password_error_wrong_current]]'));
					}
					hashAndSetPassword(callback);
				});
			});
		}
	};

};
