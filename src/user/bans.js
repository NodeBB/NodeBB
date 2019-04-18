'use strict';

const util = require('util');
const async = require('async');
const db = require('../database');

module.exports = function (User) {
	User.bans = {};

	User.bans.ban = function (uid, until, reason, callback) {
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
		} else {
			tasks.push(async.apply(db.sortedSetRemove, 'users:banned:expire', uid));
			tasks.push(async.apply(User.setUserField, uid, 'banned:expire', 0));
		}

		async.series(tasks, function (err) {
			callback(err, banData);
		});
	};

	User.bans.unban = function (uid, callback) {
		async.waterfall([
			function (next) {
				User.setUserFields(uid, { banned: 0, 'banned:expire': 0 }, next);
			},
			function (next) {
				db.sortedSetsRemove(['users:banned', 'users:banned:expire'], uid, next);
			},
		], callback);
	};

	User.bans.getBannedAndExpired = function (uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, false);
		}
		User.getUserFields(uid, ['banned', 'banned:expire'], function (err, userData) {
			if (err) {
				return callback(err);
			}
			callback(null, User.bans.calcExpiredFromUserData(userData));
		});
	};

	User.bans.calcExpiredFromUserData = function (userData) {
		return {
			banned: !!userData.banned,
			'banned:expire': userData['banned:expire'],
			banExpired: userData['banned:expire'] <= Date.now() && userData['banned:expire'] !== 0,
		};
	};

	User.bans.unbanIfExpired = function (uid, callback) {
		User.bans.getBannedAndExpired(uid, function (err, result) {
			if (err) {
				return callback(err);
			}
			if (result.banned && result.banExpired) {
				return User.bans.unban(uid, function (err) {
					callback(err, { banned: false, banExpired: true, 'banned:expire': 0 });
				});
			}
			callback(null, result);
		});
	};

	User.bans.isBanned = function (uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, false);
		}
		User.bans.unbanIfExpired(uid, function (err, result) {
			callback(err, result.banned);
		});
	};

	User.bans.getReason = function (uid, callback) {
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

	// TODO Remove in v1.13.0
	const deprecatedMessage = (oldPath, newPath) => `function ${oldPath} is deprecated, please use ${newPath} instead`;
	User.ban = util.deprecate(User.bans.ban, deprecatedMessage('User.ban', 'User.bans.ban'));
	User.unban = util.deprecate(User.bans.unban, deprecatedMessage('User.unban', 'User.bans.unban'));
	User.getBannedAndExpired = util.deprecate(User.bans.getBannedAndExpired, deprecatedMessage('User.getBannedAndExpired', 'User.bans.getBannedAndExpired'));
	User.calcBanExpiredFromUserData = util.deprecate(User.bans.calcExpiredFromUserData, deprecatedMessage('User.calcBanExpiredFromUserData', 'User.bans.calcExpiredFromUserData'));
	User.unbanIfBanExpired = util.deprecate(User.bans.unbanIfExpired, deprecatedMessage('User.unbanIfBanExpired', 'User.bans.unbanIfExpired'));
	User.isBanned = util.deprecate(User.bans.isBanned, deprecatedMessage('User.isBanned', 'User.bans.isBanned'));
	User.getBannedReason = util.deprecate(User.bans.getReason, deprecatedMessage('User.getBannedReason', 'User.bans.getReason'));
};
