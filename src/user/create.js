'use strict';

var async = require('async'),
	db = require('../database'),
	utils = require('../../public/src/utils'),
	validator = require('validator'),
	plugins = require('../plugins'),
	groups = require('../groups'),
	meta = require('../meta'),
	notifications = require('../notifications'),
	translator = require('../../public/src/translator');

module.exports = function(User) {

	User.create = function(data, callback) {
		var gravatar = User.createGravatarURLFromEmail(data.email);
		var timestamp = Date.now();
		var password = data.password;

		var userData = {
			'username': data.username.trim(),
			'email': data.email,
			'joindate': timestamp,
			'picture': gravatar,
			'gravatarpicture': gravatar,
			'fullname': '',
			'location': '',
			'birthday': '',
			'website': '',
			'signature': '',
			'uploadedpicture': '',
			'profileviews': 0,
			'reputation': 0,
			'postcount': 0,
			'lastposttime': 0,
			'banned': 0,
			'status': 'online'
		};

		userData.userslug = utils.slugify(userData.username);

		if (userData.email !== undefined) {
			userData.email = userData.email.trim();
			userData.email = validator.escape(userData.email);
		}

		async.parallel({
			emailValid: function(next) {
				if (userData.email) {
					next(!utils.isEmailValid(userData.email) ? new Error('[[error:invalid-email]]') : null);
				} else {
					next();
				}
			},
			userNameValid: function(next) {
				next((!utils.isUserNameValid(userData.username) || !userData.userslug) ? new Error('[[error:invalid-username]]') : null);
			},
			passwordValid: function(next) {
				if (password) {
					next(!utils.isPasswordValid(password) ? new Error('[[error:invalid-password]]') : null);
				} else {
					next();
				}
			},
			renamedUsername: function(next) {
				meta.userOrGroupExists(userData.userslug, function(err, exists) {
					if (err) {
						return next(err);
					}

					if (exists) {
						var	newUsername = '';
						async.forever(function(next) {
							newUsername = userData.username + (Math.floor(Math.random() * 255) + 1);
							User.exists(newUsername, function(err, exists) {
								if (err) {
									return callback(err);
								}
								if (!exists) {
									next(newUsername);
								} else {
									next();
								}
							});
						}, function(username) {
							next(null, username);
						});
					} else {
						next();
					}
				});
			},
			emailAvailable: function(next) {
				if (userData.email) {
					User.email.available(userData.email, function(err, available) {
						if (err) {
							return next(err);
						}
						next(!available ? new Error('[[error:email-taken]]') : null);
					});
				} else {
					next();
				}
			},
			customFields: function(next) {
				plugins.fireHook('filter:user.custom_fields', [], next);
			},
			userData: function(next) {
				plugins.fireHook('filter:user.create', userData, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			var customData = {};
			results.customFields.forEach(function(customField) {
				if (data[customField]) {
					customData[customField] = data[customField];
				}
			});

			userData = utils.merge(results.userData, customData);

			var userNameChanged = !!results.renamedUsername;

			if (userNameChanged) {
				userData.username = results.renamedUsername;
				userData.userslug = utils.slugify(results.renamedUsername);
			}

			db.incrObjectField('global', 'nextUid', function(err, uid) {
				if (err) {
					return callback(err);
				}

				userData.uid = uid;

				db.setObject('user:' + uid, userData, function(err) {
					if (err) {
						return callback(err);
					}

					db.setObjectField('username:uid', userData.username, uid);
					db.setObjectField('userslug:uid', userData.userslug, uid);

					if (userData.email !== undefined) {
						db.setObjectField('email:uid', userData.email.toLowerCase(), uid);
						if (parseInt(uid, 10) !== 1 && parseInt(meta.config.requireEmailConfirmation, 10) === 1) {
							User.email.verify(uid, userData.email);
						}
					}

					plugins.fireHook('action:user.create', userData);
					db.incrObjectField('global', 'userCount');

					db.sortedSetAdd('users:joindate', timestamp, uid);
					db.sortedSetAdd('users:postcount', 0, uid);
					db.sortedSetAdd('users:reputation', 0, uid);

					groups.join('registered-users', uid);

					if (userNameChanged) {
						notifications.create({
							bodyShort: '[[user:username_taken_workaround, ' + userData.username + ']]',
							bodyLong: '',
							image: 'brand:logo',
							datetime: Date.now()
						}, function(err, nid) {
							if (!err) {
								notifications.push(nid, uid);
							}
						});
					}

					if (password) {
						User.hashPassword(password, function(err, hash) {
							if(err) {
								return callback(err);
							}

							User.setUserField(uid, 'password', hash);
							callback(null, uid);
						});
					} else {
						callback(null, uid);
					}
				});
			});
		});
	};
};
