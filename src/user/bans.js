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
		} else {
			until = 0;
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

	User.isBanned = function (uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, false);
		}
		async.waterfall([
			async.apply(User.getUserFields, uid, ['banned', 'banned:expire']),
			function (userData, next) {
				var banned = userData && userData.banned;
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
					async.apply(User.setUserFields, uid, { banned: 0, 'banned:expire': 0 }),
				], function (err) {
					next(err, false);
				});
			},
		], callback);
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
