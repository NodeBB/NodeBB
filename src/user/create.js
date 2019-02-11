'use strict';

var async = require('async');
var zxcvbn = require('zxcvbn');
var db = require('../database');
var utils = require('../utils');
var plugins = require('../plugins');
var groups = require('../groups');
var meta = require('../meta');


module.exports = function (User) {
	User.create = function (data, callback) {
		data.username = data.username.trim();
		data.userslug = utils.slugify(data.username);
		if (data.email !== undefined) {
			data.email = String(data.email).trim();
		}
		var timestamp = data.timestamp || Date.now();
		var userData;
		var userNameChanged = false;

		async.waterfall([
			function (next) {
				User.isDataValid(data, next);
			},
			function (next) {
				userData = {
					username: data.username,
					userslug: data.userslug,
					email: data.email || '',
					joindate: timestamp,
					lastonline: timestamp,
					picture: data.picture || '',
					fullname: data.fullname || '',
					location: data.location || '',
					birthday: data.birthday || '',
					website: '',
					signature: '',
					uploadedpicture: '',
					profileviews: 0,
					reputation: 0,
					postcount: 0,
					topiccount: 0,
					lastposttime: 0,
					banned: 0,
					status: 'online',
					gdpr_consent: data.gdpr_consent === true ? 1 : 0,
					acceptTos: data.acceptTos === true ? 1 : 0,
				};

				User.uniqueUsername(userData, next);
			},
			function (renamedUsername, next) {
				userNameChanged = !!renamedUsername;

				if (userNameChanged) {
					userData.username = renamedUsername;
					userData.userslug = utils.slugify(renamedUsername);
				}
				plugins.fireHook('filter:user.create', { user: userData, data: data }, next);
			},
			function (results, next) {
				userData = results.user;
				db.incrObjectField('global', 'nextUid', next);
			},
			function (uid, next) {
				userData.uid = uid;
				db.setObject('user:' + uid, userData, next);
			},
			function (next) {
				async.parallel([
					function (next) {
						db.incrObjectField('global', 'userCount', next);
					},
					function (next) {
						db.sortedSetAdd('username:uid', userData.uid, userData.username, next);
					},
					function (next) {
						db.sortedSetAdd('username:sorted', 0, userData.username.toLowerCase() + ':' + userData.uid, next);
					},
					function (next) {
						db.sortedSetAdd('userslug:uid', userData.uid, userData.userslug, next);
					},
					function (next) {
						var sets = ['users:joindate', 'users:online'];
						if (parseInt(userData.uid, 10) !== 1) {
							sets.push('users:notvalidated');
						}
						db.sortedSetsAdd(sets, timestamp, userData.uid, next);
					},
					function (next) {
						db.sortedSetsAdd(['users:postcount', 'users:reputation'], 0, userData.uid, next);
					},
					function (next) {
						db.sortedSetAdd('user:' + userData.uid + ':usernames', timestamp, userData.username, next);
					},
					function (next) {
						groups.join('registered-users', userData.uid, next);
					},
					function (next) {
						User.notifications.sendWelcomeNotification(userData.uid, next);
					},
					function (next) {
						if (userData.email) {
							async.parallel([
								async.apply(db.sortedSetAdd, 'email:uid', userData.uid, userData.email.toLowerCase()),
								async.apply(db.sortedSetAdd, 'email:sorted', 0, userData.email.toLowerCase() + ':' + userData.uid),
								async.apply(db.sortedSetAdd, 'user:' + userData.uid + ':emails', timestamp, userData.email),
							], next);

							if (userData.uid > 1 && meta.config.requireEmailConfirmation) {
								User.email.sendValidationEmail(userData.uid, {
									email: userData.email,
								});
							}
						} else {
							next();
						}
					},
					function (next) {
						if (!data.password) {
							return next();
						}

						User.hashPassword(data.password, function (err, hash) {
							if (err) {
								return next(err);
							}

							async.parallel([
								async.apply(User.setUserField, userData.uid, 'password', hash),
								async.apply(User.reset.updateExpiry, userData.uid),
							], next);
						});
					},
					function (next) {
						User.updateDigestSetting(userData.uid, meta.config.dailyDigestFreq, next);
					},
				], next);
			},
			function (results, next) {
				if (userNameChanged) {
					User.notifications.sendNameChangeNotification(userData.uid, userData.username);
				}
				plugins.fireHook('action:user.create', { user: userData });
				next(null, userData.uid);
			},
		], callback);
	};

	User.isDataValid = function (userData, callback) {
		async.parallel({
			emailValid: function (next) {
				if (userData.email) {
					next(!utils.isEmailValid(userData.email) ? new Error('[[error:invalid-email]]') : null);
				} else {
					next();
				}
			},
			userNameValid: function (next) {
				next((!utils.isUserNameValid(userData.username) || !userData.userslug) ? new Error('[[error:invalid-username, ' + userData.username + ']]') : null);
			},
			passwordValid: function (next) {
				if (userData.password) {
					User.isPasswordValid(userData.password, next);
				} else {
					next();
				}
			},
			emailAvailable: function (next) {
				if (userData.email) {
					User.email.available(userData.email, function (err, available) {
						if (err) {
							return next(err);
						}
						next(!available ? new Error('[[error:email-taken]]') : null);
					});
				} else {
					next();
				}
			},
		}, function (err) {
			callback(err);
		});
	};

	User.isPasswordValid = function (password, minStrength, callback) {
		if (typeof minStrength === 'function' && !callback) {
			callback = minStrength;
			minStrength = meta.config.minimumPasswordStrength;
		}

		// Sanity checks: Checks if defined and is string
		if (!password || !utils.isPasswordValid(password)) {
			return callback(new Error('[[error:invalid-password]]'));
		}

		if (password.length < meta.config.minimumPasswordLength) {
			return callback(new Error('[[reset_password:password_too_short]]'));
		}

		if (password.length > 512) {
			return callback(new Error('[[error:password-too-long]]'));
		}

		var strength = zxcvbn(password);
		if (strength.score < minStrength) {
			return callback(new Error('[[user:weak_password]]'));
		}

		callback();
	};

	User.uniqueUsername = function (userData, callback) {
		var numTries = 0;
		function go(username) {
			async.waterfall([
				function (next) {
					meta.userOrGroupExists(username, next);
				},
				function (exists) {
					if (!exists) {
						return callback(null, numTries ? username : null);
					}
					username = userData.username + ' ' + numTries.toString(32);
					numTries += 1;
					go(username);
				},
			], callback);
		}

		go(userData.userslug);
	};
};
