'use strict';

var async = require('async');

var db = require('../database');

module.exports = function (User) {
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

		const banKey = 'uid:' + uid + ':ban:' + now;
		var banData = {
			uid: uid,
			timestamp: now,
			expire: until > now ? until : 0,
		};
		if (reason) {
			banData.reason = reason;
		}
		var tasks = [
			async.apply(User.setUserField, uid, 'banned', 1),
			async.apply(db.sortedSetAdd, 'users:banned', now, uid),
			async.apply(db.sortedSetAdd, 'uid:' + uid + ':bans:timestamp', now, banKey),
			async.apply(db.setObject, banKey, banData),
		];

		if (until > now) {
			tasks.push(async.apply(db.sortedSetAdd, 'users:banned:expire', until, uid));
			tasks.push(async.apply(User.setUserField, uid, 'banned:expire', until));
		}

		async.series(tasks, function (err) {
			callback(err, banData);
		});
	};

	User.unban = function (uid, callback) {
		async.waterfall([
			function (next) {
				User.setUserFields(uid, { banned: 0, 'banned:expire': 0 }, next);
			},
			function (next) {
				db.sortedSetsRemove(['users:banned', 'users:banned:expire'], uid, next);
			},
		], callback);
	};

	User.getBannedAndExpired = function (uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, false);
		}
		User.getUserFields(uid, ['banned', 'banned:expire'], function (err, userData) {
			if (err) {
				return callback(err);
			}
			callback(null, User.calcBanExpiredFromUserData(userData));
		});
	};

	User.calcBanExpiredFromUserData = function (userData) {
		return {
			banned: !!userData.banned,
			'banned:expire': userData['banned:expire'],
			banExpired: userData['banned:expire'] <= Date.now() && userData['banned:expire'] !== 0,
		};
	};

	User.unbanIfBanExpired = function (uid, callback) {
		User.getBannedAndExpired(uid, function (err, result) {
			if (err) {
				return callback(err);
			}
			if (result.banned && result.banExpired) {
				return User.unban(uid, function (err) {
					callback(err, { banned: false, banExpired: true, 'banned:expire': 0 });
				});
			}
			callback(null, result);
		});
	};

	User.isBanned = function (uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, false);
		}
		User.unbanIfBanExpired(uid, function (err, result) {
			callback(err, result.banned);
		});
	};

	User.getBannedReason = function (uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, '');
		}
		async.waterfall([
			function (next) {
				db.getSortedSetRevRange('uid:' + uid + ':bans:timestamp', 0, 0, next);
			},
			function (keys, next) {
				if (!keys.length) {
					return callback(null, '');
				}
				db.getObject(keys[0], next);
			},
			function (banObj, next) {
				next(null, banObj && banObj.reason ? banObj.reason : '');
			},
		], callback);
	};
};
