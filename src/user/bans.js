'use strict';

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

	User.bans.unban = async function (uids) {
		if (Array.isArray(uids)) {
			await db.setObject(uids.map(uid => 'user:' + uid), { banned: 0, 'banned:expire': 0 });
		} else {
			await User.setUserFields(uids, { banned: 0, 'banned:expire': 0 });
		}

		await db.sortedSetRemove(['users:banned', 'users:banned:expire'], uids);
	};

	User.bans.isBanned = async function (uids) {
		const isArray = Array.isArray(uids);
		uids = isArray ? uids : [uids];
		const result = await User.bans.unbanIfExpired(uids);
		return isArray ? result.map(r => r.banned) : result[0].banned;
	};

	User.bans.unbanIfExpired = async function (uids) {
		// loading user data will unban if it has expired -barisu
		const userData = await User.getUsersFields(uids, ['banned', 'banned:expire']);
		return User.bans.calcExpiredFromUserData(userData);
	};

	User.bans.calcExpiredFromUserData = function (userData) {
		const isArray = Array.isArray(userData);
		userData = isArray ? userData : [userData];
		userData = userData.map(function (userData) {
			return {
				banned: userData && !!userData.banned,
				'banned:expire': userData && userData['banned:expire'],
				banExpired: userData && userData['banned:expire'] <= Date.now() && userData['banned:expire'] !== 0,
			};
		});
		return isArray ? userData : userData[0];
	};

	User.bans.filterBanned = async function (uids) {
		const isBanned = await User.bans.isBanned(uids);
		return uids.filter((uid, index) => !isBanned[index]);
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
};
