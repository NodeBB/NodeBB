'use strict';

var async = require('async');
var validator = require('validator');

var db = require('../database');
var meta = require('../meta');
var emailer = require('../emailer');
var notifications = require('../notifications');
var groups = require('../groups');
var utils = require('../utils');
var plugins = require('../plugins');

module.exports = function (User) {
	User.addToApprovalQueue = function (userData, callback) {
		userData.userslug = utils.slugify(userData.username);
		async.waterfall([
			function (next) {
				canQueue(userData, next);
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

	function canQueue(userData, callback) {
		async.waterfall([
			function (next) {
				User.isDataValid(userData, next);
			},
			function (next) {
				db.getSortedSetRange('registration:queue', 0, -1, next);
			},
			function (usernames, next) {
				if (usernames.includes(userData.username)) {
					return next(new Error('[[error:username-taken]]'));
				}
				const keys = usernames.filter(Boolean).map(username => 'registration:queue:name:' + username);
				db.getObjectsFields(keys, ['email'], next);
			},
			function (data, next) {
				const emails = data.map(data => data && data.email);
				if (emails.includes(userData.email)) {
					return next(new Error('[[error:email-taken]]'));
				}
				next();
			},
		], callback);
	}

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
				var data = {
					username: username,
					subject: '[[email:welcome-to, ' + title + ']]',
					template: 'registration_accepted',
					uid: uid,
				};

				emailer.send('registration_accepted', uid, data, next);
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
				var keys = data.filter(Boolean).map(user => 'registration:queue:name:' + user.value);
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
					// need to keep this for getIPMatchedUsers
					user.ip = user.ip.replace('::ffff:', '');
					getIPMatchedUsers(user, function (err) {
						next(err, user);
					});
					user.customActions = [].concat(user.customActions);
					/*
						// then spam prevention plugins, using the "filter:user.getRegistrationQueue" hook can be like:
						user.customActions.push({
							title: '[[spam-be-gone:report-user]]',
							id: 'report-spam-user-' + user.username,
							class: 'btn-warning report-spam-user',
							icon: 'fa-flag'
						});
					 */
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
};
