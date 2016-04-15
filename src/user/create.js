'use strict';

var async = require('async');
var db = require('../database');
var utils = require('../../public/src/utils');
var validator = require('validator');
var plugins = require('../plugins');
var groups = require('../groups');
var meta = require('../meta');


module.exports = function(User) {

	User.create = function(data, callback) {

		data.username = data.username.trim();
		data.userslug = utils.slugify(data.username);
		if (data.email !== undefined) {
			data.email = validator.escape(data.email.trim());
		}

		User.isDataValid(data, function(err) {
			if (err)  {
				return callback(err);
			}
			var timestamp = data.timestamp || Date.now();

			var userData = {
				'username': data.username,
				'userslug': data.userslug,
				'email': data.email,
				'joindate': timestamp,
				'lastonline': timestamp,
				'picture': '',
				'fullname': data.fullname || '',
				'location': '',
				'birthday': '',
				'website': '',
				'signature': '',
				'uploadedpicture': '',
				'profileviews': 0,
				'reputation': 0,
				'postcount': 0,
				'topiccount': 0,
				'lastposttime': 0,
				'banned': 0,
				'status': 'online'
			};

			async.parallel({
				renamedUsername: function(next) {
					renameUsername(userData, next);
				},
				userData: function(next) {
					plugins.fireHook('filter:user.create', {user: userData, data: data}, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				var userNameChanged = !!results.renamedUsername;

				if (userNameChanged) {
					userData.username = results.renamedUsername;
					userData.userslug = utils.slugify(results.renamedUsername);
				}

				async.waterfall([
					function(next) {
						db.incrObjectField('global', 'nextUid', next);
					},
					function(uid, next) {
						userData.uid = uid;
						db.setObject('user:' + uid, userData, next);
					},
					function(next) {
						async.parallel([
							function(next) {
								db.incrObjectField('global', 'userCount', next);
							},
							function(next) {
								db.sortedSetAdd('username:uid', userData.uid, userData.username, next);
							},
							function(next) {
								db.sortedSetAdd('username:sorted', 0, userData.username.toLowerCase() + ':' + userData.uid, next);
							},
							function(next) {
								db.sortedSetAdd('userslug:uid', userData.uid, userData.userslug, next);
							},
							function(next) {
								var sets = ['users:joindate', 'users:online'];
								if (parseInt(userData.uid) !== 1) {
									sets.push('users:notvalidated');
								}
								db.sortedSetsAdd(sets, timestamp, userData.uid, next);
							},
							function(next) {
								db.sortedSetsAdd(['users:postcount', 'users:reputation'], 0, userData.uid, next);
							},
							function(next) {
								groups.join('registered-users', userData.uid, next);
							},
							function(next) {
								User.notifications.sendWelcomeNotification(userData.uid, next);
							},
							function(next) {
								if (userData.email) {
									async.parallel([
										async.apply(db.sortedSetAdd, 'email:uid', userData.uid, userData.email.toLowerCase()),
										async.apply(db.sortedSetAdd, 'email:sorted', 0, userData.email.toLowerCase() + ':' + userData.uid)
									], next);

									if (parseInt(userData.uid, 10) !== 1 && parseInt(meta.config.requireEmailConfirmation, 10) === 1) {
										User.email.sendValidationEmail(userData.uid, userData.email);
									}
								} else {
									next();
								}
							},
							function(next) {
								if (!data.password) {
									return next();
								}

								User.hashPassword(data.password, function(err, hash) {
									if (err) {
										return next(err);
									}

									async.parallel([
										async.apply(User.setUserField, userData.uid, 'password', hash),
										async.apply(User.reset.updateExpiry, userData.uid)
									], next);
								});
							}
						], next);
					},
					function(results, next) {
						if (userNameChanged) {
							User.notifications.sendNameChangeNotification(userData.uid, userData.username);
						}
						plugins.fireHook('action:user.create', userData);
						next(null, userData.uid);
					}
				], callback);
			});
		});
	};

	User.isDataValid = function(userData, callback) {
		async.parallel({
			emailValid: function(next) {
				if (userData.email) {
					next(!utils.isEmailValid(userData.email) ? new Error('[[error:invalid-email]]') : null);
				} else {
					next();
				}
			},
			userNameValid: function(next) {
				next((!utils.isUserNameValid(userData.username) || !userData.userslug) ? new Error('[[error:invalid-username, ' + userData.username + ']]') : null);
			},
			passwordValid: function(next) {
				if (userData.password) {
					User.isPasswordValid(userData.password, next);
				} else {
					next();
				}
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
			}
		}, function(err) {
			callback(err);
		});
	};

	User.isPasswordValid = function(password, callback) {
		if (!password || !utils.isPasswordValid(password)) {
			return callback(new Error('[[error:invalid-password]]'));
		}

		if (password.length < meta.config.minimumPasswordLength) {
			return callback(new Error('[[user:change_password_error_length]]'));
		}

		if (password.length > 4096) {
			return callback(new Error('[[error:password-too-long]]'));
		}

		callback();
	};

	function renameUsername(userData, callback) {
		meta.userOrGroupExists(userData.userslug, function(err, exists) {
			if (err || !exists) {
				return callback(err);
			}

			var	newUsername = '';
			async.forever(function(next) {
				newUsername = userData.username + (Math.floor(Math.random() * 255) + 1);
				User.existsBySlug(newUsername, function(err, exists) {
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
				callback(null, username);
			});
		});
	}

};
