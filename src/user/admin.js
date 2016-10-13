
'use strict';

var async = require('async');
var db = require('../database');
var posts = require('../posts');
var plugins = require('../plugins');
var winston = require('winston');

module.exports = function (User) {

	User.logIP = function (uid, ip) {
		var now = Date.now();
		db.sortedSetAdd('uid:' + uid + ':ip', now, ip || 'Unknown');
		if (ip) {
			db.sortedSetAdd('ip:' + ip + ':uid', now, uid);
		}
	};

	User.getIPs = function (uid, stop, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':ip', 0, stop, function (err, ips) {
			if (err) {
				return callback(err);
			}

			callback(null, ips);
		});
	};

	User.getUsersCSV = function (callback) {
		winston.info('[user/getUsersCSV] Compiling User CSV data');
		var csvContent = '';

		async.waterfall([
			function (next) {
				db.getSortedSetRangeWithScores('username:uid', 0, -1, next);
			},
			function (users, next) {
				var uids = users.map(function (user) {
					return user.score;
				});
				User.getUsersFields(uids, ['uid', 'email', 'username'], next);
			},
			function (usersData, next) {
				usersData.forEach(function (user) {
					if (user) {
						csvContent += user.email + ',' + user.username + ',' + user.uid + '\n';
					}
				});

				next(null, csvContent);
			}
		], callback);
	};

	User.ban = function (uid, until, reason, callback) {
		// "until" (optional) is unix timestamp in milliseconds
		// "reason" (optional) is a string
		if (!callback && typeof until === 'function') {
			callback = until;
			until = 0;
			reason = '';
		} else if (!callback && typeof reason === 'function') {
			callback = reason;
			reason = '';
		}

		var now = Date.now();

		until = parseInt(until, 10);
		if (isNaN(until)) {
			return callback(new Error('[[error:ban-expiry-missing]]'));
		}

		var tasks = [
			async.apply(User.setUserField, uid, 'banned', 1),
			async.apply(db.sortedSetAdd, 'users:banned', now, uid),
			async.apply(db.sortedSetAdd, 'uid:' + uid + ':bans', now, until)
		];

		if (until > 0 && now < until) {
			tasks.push(async.apply(db.sortedSetAdd, 'users:banned:expire', until, uid));
			tasks.push(async.apply(User.setUserField, uid, 'banned:expire', until));
		} else {
			until = 0;
		}

		if (reason) {
			tasks.push(async.apply(db.sortedSetAdd, 'banned:' + uid + ':reasons', now, reason));
		}

		async.series(tasks, function (err) {
			if (err) {
				return callback(err);
			}

			plugins.fireHook('action:user.banned', {
				uid: uid,
				until: until > 0 ? until : undefined
			});
			callback();
		});
	};

	User.unban = function (uid, callback) {
		async.waterfall([
			function (next) {
				User.setUserFields(uid, {banned: 0, 'banned:expire': 0}, next);
			},
			function (next) {
				db.sortedSetsRemove(['users:banned', 'users:banned:expire'], uid, next);
			},
			function (next) {
				plugins.fireHook('action:user.unbanned', {uid: uid});
				next();
			}
		], callback);
	};

	User.isBanned = function (uid, callback) {
		async.waterfall([
			async.apply(User.getUserFields, uid, ['banned', 'banned:expire']),
			function (userData, next) {
				var banned = parseInt(userData.banned, 10) === 1;
				if (!banned) {
					return next(null, banned);
				}

				// If they are banned, see if the ban has expired
				var stillBanned = !userData['banned:expire'] || Date.now() < userData['banned:expire'];

				if (stillBanned) {
					return next(null, true);
				}
				async.parallel([
					async.apply(db.sortedSetRemove.bind(db), 'users:banned:expire', uid),
					async.apply(db.sortedSetRemove.bind(db), 'users:banned', uid),
					async.apply(User.setUserFields, uid, {banned:0, 'banned:expire': 0})
				], function (err) {
					next(err, false);
				});
			}
		], callback);
	};

	User.resetFlags = function (uids, callback) {
		if (!Array.isArray(uids) || !uids.length) {
			return callback();
		}

		async.eachSeries(uids, function (uid, next) {
			posts.dismissUserFlags(uid, next);
		}, callback);
	};
};
