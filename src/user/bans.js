'use strict';

const util = require('util');
const db = require('../database');

module.exports = function (User) {
	User.bans = {};

	User.bans.ban = async function (uid, until, reason) {
		// "until" (optional) is unix timestamp in milliseconds
		// "reason" (optional) is a string
		until = until || 0;
		reason = reason || '';

		const now = Date.now();

		until = parseInt(until, 10);
		if (isNaN(until)) {
			throw new Error('[[error:ban-expiry-missing]]');
		}

		const banKey = 'uid:' + uid + ':ban:' + now;
		const banData = {
			uid: uid,
			timestamp: now,
			expire: until > now ? until : 0,
		};
		if (reason) {
			banData.reason = reason;
		}

		await User.setUserField(uid, 'banned', 1);
		await db.sortedSetAdd('users:banned', now, uid);
		await db.sortedSetAdd('uid:' + uid + ':bans:timestamp', now, banKey);
		await db.setObject(banKey, banData);
		await User.setUserField(uid, 'banned:expire', banData.expire);
		if (until > now) {
			await db.sortedSetAdd('users:banned:expire', until, uid);
		} else {
			await db.sortedSetRemove('users:banned:expire', uid);
		}
		return banData;
	};

	User.bans.unban = async function (uid) {
		await User.setUserFields(uid, { banned: 0, 'banned:expire': 0 });
		await db.sortedSetsRemove(['users:banned', 'users:banned:expire'], uid);
	};

	User.bans.getBannedAndExpired = async function (uid) {
		if (parseInt(uid, 10) <= 0) {
			return false;
		}
		const userData = await User.getUserFields(uid, ['banned', 'banned:expire']);
		return User.bans.calcExpiredFromUserData(userData);
	};

	User.bans.calcExpiredFromUserData = function (userData) {
		return {
			banned: !!userData.banned,
			'banned:expire': userData['banned:expire'],
			banExpired: userData['banned:expire'] <= Date.now() && userData['banned:expire'] !== 0,
		};
	};

	User.bans.unbanIfExpired = async function (uid) {
		const result = await User.bans.getBannedAndExpired(uid);
		if (result.banned && result.banExpired) {
			await User.bans.unban(uid);
			return { banned: false, banExpired: true, 'banned:expire': 0 };
		}
		return result;
	};

	User.bans.isBanned = async function (uid) {
		if (parseInt(uid, 10) <= 0) {
			return false;
		}
		const result = await User.bans.unbanIfExpired(uid);
		return result.banned;
	};

	User.bans.getReason = async function (uid) {
		if (parseInt(uid, 10) <= 0) {
			return '';
		}
		const keys = await db.getSortedSetRevRange('uid:' + uid + ':bans:timestamp', 0, 0);
		if (!keys.length) {
			return '';
		}
		const banObj = await db.getObject(keys[0]);
		return banObj && banObj.reason ? banObj.reason : '';
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
