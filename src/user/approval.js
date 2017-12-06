
'use strict';

var async = require('async');
var request = require('request');
var winston = require('winston');
var validator = require('validator');

var db = require('../database');
var meta = require('../meta');
var emailer = require('../emailer');
var notifications = require('../notifications');
var groups = require('../groups');
var translator = require('../translator');
var utils = require('../utils');
var plugins = require('../plugins');

module.exports = function (User) {
	User.addToApprovalQueue = function (userData, callback) {
		userData.userslug = utils.slugify(userData.username);
		async.waterfall([
			function (next) {
				User.isDataValid(userData, next);
			},
			function (next) {
				User.hashPassword(userData.password, next);
			},
			function (hashedPassword, next) {
				var data = {
					username: userData.username,
					email: userData.email,
					ip: userData.ip,
					hashedPassword: hashedPassword,
				};
				plugins.fireHook('filter:user.addToApprovalQueue', { data: data, userData: userData }, next);
			},
			function (results, next) {
				db.setObject('registration:queue:name:' + userData.username, results.data, next);
			},
			function (next) {
				db.sortedSetAdd('registration:queue', Date.now(), userData.username, next);
			},
			function (next) {
				sendNotificationToAdmins(userData.username, next);
			},
		], callback);
	};

	function sendNotificationToAdmins(username, callback) {
		async.waterfall([
			function (next) {
				notifications.create({
					type: 'new-register',
					bodyShort: '[[notifications:new_register, ' + username + ']]',
					nid: 'new_register:' + username,
					path: '/admin/manage/registration',
					mergeId: 'new_register',
				}, next);
			},
			function (notification, next) {
				notifications.pushGroup(notification, 'administrators', next);
			},
		], callback);
	}

	User.acceptRegistration = function (username, callback) {
		var uid;
		var userData;
		async.waterfall([
			function (next) {
				db.getObject('registration:queue:name:' + username, next);
			},
			function (_userData, next) {
				if (!_userData) {
					return callback(new Error('[[error:invalid-data]]'));
				}
				userData = _userData;
				User.create(userData, next);
			},
			function (_uid, next) {
				uid = _uid;
				User.setUserField(uid, 'password', userData.hashedPassword, next);
			},
			function (next) {
				removeFromQueue(username, next);
			},
			function (next) {
				markNotificationRead(username, next);
			},
			function (next) {
				var title = meta.config.title || meta.config.browserTitle || 'NodeBB';
				translator.translate('[[email:welcome-to, ' + title + ']]', meta.config.defaultLang, function (subject) {
					var data = {
						username: username,
						subject: subject,
						template: 'registration_accepted',
						uid: uid,
					};

					emailer.send('registration_accepted', uid, data, next);
				});
			},
			function (next) {
				next(null, uid);
			},
		], callback);
	};

	function markNotificationRead(username, callback) {
		var nid = 'new_register:' + username;
		async.waterfall([
			function (next) {
				groups.getMembers('administrators', 0, -1, next);
			},
			function (uids, next) {
				async.each(uids, function (uid, next) {
					notifications.markRead(nid, uid, next);
				}, next);
			},
		], callback);
	}

	User.rejectRegistration = function (username, callback) {
		async.waterfall([
			function (next) {
				removeFromQueue(username, next);
			},
			function (next) {
				markNotificationRead(username, next);
			},
		], callback);
	};

	function removeFromQueue(username, callback) {
		async.parallel([
			async.apply(db.sortedSetRemove, 'registration:queue', username),
			async.apply(db.delete, 'registration:queue:name:' + username),
		], function (err) {
			callback(err);
		});
	}

	User.shouldQueueUser = function (ip, callback) {
		var registrationType = meta.config.registrationType || 'normal';
		if (registrationType === 'normal' || registrationType === 'invite-only' || registrationType === 'admin-invite-only') {
			setImmediate(callback, null, false);
		} else if (registrationType === 'admin-approval') {
			setImmediate(callback, null, true);
		} else if (registrationType === 'admin-approval-ip') {
			db.sortedSetCard('ip:' + ip + ':uid', function (err, count) {
				callback(err, !!count);
			});
		}
	};

	User.getRegistrationQueue = function (start, stop, callback) {
		var data;
		async.waterfall([
			function (next) {
				db.getSortedSetRevRangeWithScores('registration:queue', start, stop, next);
			},
			function (_data, next) {
				data = _data;
				var keys = data.filter(Boolean).map(function (user) {
					return 'registration:queue:name:' + user.value;
				});
				db.getObjects(keys, next);
			},
			function (users, next) {
				users = users.filter(Boolean).map(function (user, index) {
					user.timestampISO = utils.toISOString(data[index].score);
					user.email = validator.escape(String(user.email));
					delete user.hashedPassword;
					return user;
				});

				async.map(users, function (user, next) {
					// temporary: see http://www.stopforumspam.com/forum/viewtopic.php?id=6392
					user.ip = user.ip.replace('::ffff:', '');

					async.parallel([
						function (next) {
							getIPMatchedUsers(user, next);
						},
						function (next) {
							getSpamData(user, next);
						},
					], function (err) {
						next(err, user);
					});
				}, next);
			},
			function (users, next) {
				plugins.fireHook('filter:user.getRegistrationQueue', { users: users }, next);
			},
			function (results, next) {
				next(null, results.users);
			},
		], callback);
	};

	function getIPMatchedUsers(user, callback) {
		async.waterfall([
			function (next) {
				User.getUidsFromSet('ip:' + user.ip + ':uid', 0, -1, next);
			},
			function (uids, next) {
				User.getUsersFields(uids, ['uid', 'username', 'picture'], next);
			},
			function (data, next) {
				user.ipMatch = data;
				next();
			},
		], callback);
	}

	function getSpamData(user, callback) {
		async.waterfall([
			function (next) {
				request({
					method: 'get',
					url: 'http://api.stopforumspam.org/api' +
						'?ip=' + encodeURIComponent(user.ip) +
						'&email=' + encodeURIComponent(user.email) +
						'&username=' + encodeURIComponent(user.username) +
						'&f=json',
					json: true,
				}, next);
			},
			function (response, body, next) {
				if (response.statusCode === 200 && body) {
					user.spamData = body;
					user.usernameSpam = body.username ? (body.username.frequency > 0 || body.username.appears > 0) : true;
					user.emailSpam = body.email ? (body.email.frequency > 0 || body.email.appears > 0) : true;
					user.ipSpam = body.ip ? (body.ip.frequency > 0 || body.ip.appears > 0) : true;
				}
				next();
			},
		], function (err) {
			if (err) {
				winston.error(err);
			}
			callback();
		});
	}
};
