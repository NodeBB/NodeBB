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

	User.create = function(userData, callback) {
		userData = userData || {};
		userData.userslug = utils.slugify(userData.username);

		userData.username = userData.username.trim();
		if (userData.email !== undefined) {
			userData.email = userData.email.trim();
			userData.email = validator.escape(userData.email);
		}

		var password = userData.password;
		userData.password = null;

		async.parallel([
			function(next) {
				if (userData.email) {
					next(!utils.isEmailValid(userData.email) ? new Error('[[error:invalid-email]]') : null);
				} else {
					next();
				}
			},
			function(next) {
				next((!utils.isUserNameValid(userData.username) || !userData.userslug) ? new Error('[[error:invalid-username]]') : null);
			},
			function(next) {
				if (userData.password) {
					next(!utils.isPasswordValid(userData.password) ? new Error('[[error:invalid-password]]') : null);
				} else {
					next();
				}
			},
			function(next) {
				meta.userOrGroupExists(userData.userslug, function(err, exists) {
					if (err) {
						return next(err);
					}

					if (exists) {
						async.forever(function(next) {
							var	newUsername = userData.username + (Math.floor(Math.random() * 255) + 1);
							User.exists(newUsername, function(err, exists) {
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
			function(next) {
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
			function(next) {
				plugins.fireHook('filter:user.create', userData, function(err, filteredUserData){
					next(err, utils.merge(userData, filteredUserData));
				});
			}
		], function(err, results) {
			if (err) {
				return callback(err);
			}

			userData = results[results.length - 1];
			var userNameChanged = !!results[3];
			// If a new username was picked...
			if (userNameChanged) {
				userData.username = results[3];
				userData.userslug = utils.slugify(results[3]);
			}

			db.incrObjectField('global', 'nextUid', function(err, uid) {
				if(err) {
					return callback(err);
				}

				var gravatar = User.createGravatarURLFromEmail(userData.email);
				var timestamp = Date.now();

				userData = {
					'uid': uid,
					'username': userData.username,
					'userslug': userData.userslug,
					'fullname': '',
					'location': '',
					'birthday': '',
					'website': '',
					'email': userData.email || '',
					'signature': '',
					'joindate': timestamp,
					'picture': gravatar,
					'gravatarpicture': gravatar,
					'uploadedpicture': '',
					'profileviews': 0,
					'reputation': 0,
					'postcount': 0,
					'lastposttime': 0,
					'banned': 0,
					'status': 'online'
				};

				db.setObject('user:' + uid, userData, function(err) {
					if(err) {
						return callback(err);
					}

					db.setObjectField('username:uid', userData.username, uid);
					db.setObjectField('userslug:uid', userData.userslug, uid);

					if (userData.email !== undefined) {
						db.setObjectField('email:uid', userData.email, uid);
						if (parseInt(uid, 10) !== 1 && (parseInt(meta.config.requireEmailConfirmation, 10) === 1 || meta.config.requireEmailConfirmation === undefined)) {
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
							text: '[[user:username_taken_workaround, ' + userData.username + ']]',
							image: 'brand:logo',
							datetime: Date.now()
						}, function(nid) {
							notifications.push(nid, uid);
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
