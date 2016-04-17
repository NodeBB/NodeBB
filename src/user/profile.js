
'use strict';

var async = require('async');
var S = require('string');

var utils = require('../../public/src/utils');
var meta = require('../meta');
var db = require('../database');
var plugins = require('../plugins');

module.exports = function(User) {

	User.updateProfile = function(uid, data, callback) {
		var fields = ['username', 'email', 'fullname', 'website', 'location', 'groupTitle', 'birthday', 'signature', 'aboutme'];

		plugins.fireHook('filter:user.updateProfile', {uid: uid, data: data, fields: fields}, function(err, data) {
			if (err) {
				return callback(err);
			}

			fields = data.fields;
			data = data.data;

			function isAboutMeValid(next) {
				if (data.aboutme !== undefined && data.aboutme.length > meta.config.maximumAboutMeLength) {
					next(new Error('[[error:about-me-too-long, ' + meta.config.maximumAboutMeLength + ']]'));
				} else {
					next();
				}
			}

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
				if (!data.username) {
					return next();
				}
				data.username = data.username.trim();
				User.getUserFields(uid, ['username', 'userslug'], function(err, userData) {
					if (err) {
						return next(err);
					}

					var userslug = utils.slugify(data.username);

					if (data.username.length < meta.config.minimumUsernameLength) {
						return next(new Error('[[error:username-too-short]]'));
					}

					if (data.username.length > meta.config.maximumUsernameLength) {
						return next(new Error('[[error:username-too-long]]'));
					}

					if (!utils.isUserNameValid(data.username) || !userslug) {
						return next(new Error('[[error:invalid-username]]'));
					}

					if (userslug === userData.userslug) {
						return next();
					}

					User.existsBySlug(userslug, function(err, exists) {
						if (err) {
							return next(err);
						}

						next(exists ? new Error('[[error:username-taken]]') : null);
					});
				});
			}

			async.series([isAboutMeValid, isSignatureValid, isEmailAvailable, isUsernameAvailable], function(err) {
				if (err) {
					return callback(err);
				}

				async.each(fields, updateField, function(err) {
					if (err) {
						return callback(err);
					}
					plugins.fireHook('action:user.updateProfile', {data: data, uid: uid});
					User.getUserFields(uid, ['email', 'username', 'userslug', 'picture', 'icon:text', 'icon:bgColor'], callback);
				});
			});

			function updateField(field, next) {
				if (!(data[field] !== undefined && typeof data[field] === 'string')) {
					return next();
				}

				data[field] = data[field].trim();

				if (field === 'email') {
					return updateEmail(uid, data.email, next);
				} else if (field === 'username') {
					return updateUsername(uid, data.username, next);
				} else if (field === 'fullname') {
					return updateFullname(uid, data.fullname, next);
				} else if (field === 'signature') {
					data[field] = S(data[field]).stripTags().s;
				}

				User.setUserField(uid, field, data[field], next);
			}
		});
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
			async.series([
				async.apply(db.sortedSetRemove, 'email:uid', userData.email.toLowerCase()),
				async.apply(db.sortedSetRemove, 'email:sorted', userData.email.toLowerCase() + ':' + uid)
			], function(err) {
				if (err) {
					return callback(err);
				}

				async.parallel([
					function(next) {
						db.sortedSetAdd('email:uid', uid, newEmail.toLowerCase(), next);
					},
					function(next) {
						db.sortedSetAdd('email:sorted',  0, newEmail.toLowerCase() + ':' + uid, next);
					},
					function(next) {
						User.setUserField(uid, 'email', newEmail, next);
					},
					function(next) {
						if (parseInt(meta.config.requireEmailConfirmation, 10) === 1 && newEmail) {
							User.email.sendValidationEmail(uid, newEmail);
						}
						User.setUserField(uid, 'email:confirmed', 0, next);
					},
					function (next) {
						db.sortedSetAdd('users:notvalidated', Date.now(), uid, next);
					}
				], callback);
			});
		});
	}

	function updateUsername(uid, newUsername, callback) {
		if (!newUsername) {
			return callback();
		}

		User.getUserFields(uid, ['username', 'userslug'], function(err, userData) {
			if (err) {
				return callback(err);
			}

			async.parallel([
				function(next) {
					updateUidMapping('username', uid, newUsername, userData.username, next);
				},
				function(next) {
					var newUserslug = utils.slugify(newUsername);
					updateUidMapping('userslug', uid, newUserslug, userData.userslug, next);
				},
				function(next) {
					async.series([
						async.apply(db.sortedSetRemove, 'username:sorted', userData.username.toLowerCase() + ':' + uid),
						async.apply(db.sortedSetAdd, 'username:sorted', 0, newUsername.toLowerCase() + ':' + uid)
					], next);
				},
			], callback);
		});
	}

	function updateUidMapping(field, uid, value, oldValue, callback) {
		if (value === oldValue) {
			return callback();
		}

		async.series([
			function(next) {
				db.sortedSetRemove(field + ':uid', oldValue, next);
			},
			function(next) {
				User.setUserField(uid, field, value, next);
			},
			function(next) {
				if (value) {
					db.sortedSetAdd(field + ':uid', uid, value, next);
				} else {
					next();
				}
			}
		], callback);
	}

	function updateFullname(uid, newFullname, callback) {
		async.waterfall([
			function(next) {
				User.getUserField(uid, 'fullname', next);
			},
			function(fullname, next) {
				updateUidMapping('fullname', uid, newFullname, fullname, next);
			}
		], callback);
	}

	User.changePassword = function(uid, data, callback) {
		if (!uid || !data || !data.uid) {
			return callback(new Error('[[error:invalid-uid]]'));
		}

		async.waterfall([
			function (next) {
				User.isPasswordValid(data.newPassword, next);
			},
			function (next) {
				if (parseInt(uid, 10) !== parseInt(data.uid, 10)) {
					User.isAdministrator(uid, next);
				} else {
					User.isPasswordCorrect(uid, data.currentPassword, next);
				}
			},
			function (isAdminOrPasswordMatch, next) {
				if (!isAdminOrPasswordMatch) {
					return next(new Error('[[error:change_password_error_wrong_current]]'));
				}

				User.hashPassword(data.newPassword, next);
			},
			function (hashedPassword, next) {
				async.parallel([
					async.apply(User.setUserField, data.uid, 'password', hashedPassword),
					async.apply(User.reset.updateExpiry, data.uid)
				], function(err) {
					next(err);
				});
			}
		], callback);
	};
};
