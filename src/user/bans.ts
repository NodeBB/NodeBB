'use strict';

const winston = require('winston');

const meta = require('../meta');
const emailer = require('../emailer');
const db = require('../database');
const groups = require('../groups');
const privileges = require('../privileges');

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

		const banKey = `uid:${uid}:ban:${now}`;
		const banData = {
			uid: uid,
			timestamp: now,
			expire: until > now ? until : 0,
		};
		if (reason) {
			banData.reason = reason;
		}

		// Leaving all other system groups to have privileges constrained to the "banned-users" group
		const systemGroups = groups.systemGroups.filter(group => group !== groups.BANNED_USERS);
		await groups.leave(systemGroups, uid);
		await groups.join(groups.BANNED_USERS, uid);
		await db.sortedSetAdd('users:banned', now, uid);
		await db.sortedSetAdd(`uid:${uid}:bans:timestamp`, now, banKey);
		await db.setObject(banKey, banData);
		await User.setUserField(uid, 'banned:expire', banData.expire);
		if (until > now) {
			await db.sortedSetAdd('users:banned:expire', until, uid);
		} else {
			await db.sortedSetRemove('users:banned:expire', uid);
		}

		// Email notification of ban
		const username = await User.getUserField(uid, 'username');
		const siteTitle = meta.config.title || 'NodeBB';

		const data = {
			subject: `[[email:banned.subject, ${siteTitle}]]`,
			username: username,
			until: until ? (new Date(until)).toUTCString().replace(/,/g, '\\,') : false,
			reason: reason,
		};
		await emailer.send('banned', uid, data).catch(err => winston.error(`[emailer.send] ${err.stack}`));

		return banData;
	};

	User.bans.unban = async function (uids) {
		uids = Array.isArray(uids) ? uids : [uids];
		const userData = await User.getUsersFields(uids, ['email:confirmed']);

		await db.setObject(uids.map(uid => `user:${uid}`), { 'banned:expire': 0 });

		/* eslint-disable no-await-in-loop */
		for (const user of userData) {
			const systemGroupsToJoin = [
				'registered-users',
				(parseInt(user['email:confirmed'], 10) === 1 ? 'verified-users' : 'unverified-users'),
			];
			await groups.leave(groups.BANNED_USERS, user.uid);
			// An unbanned user would lost its previous "Global Moderator" status
			await groups.join(systemGroupsToJoin, user.uid);
		}

		await db.sortedSetRemove(['users:banned', 'users:banned:expire'], uids);
	};

	User.bans.isBanned = async function (uids) {
		const isArray = Array.isArray(uids);
		uids = isArray ? uids : [uids];
		const result = await User.bans.unbanIfExpired(uids);
		return isArray ? result.map(r => r.banned) : result[0].banned;
	};

	User.bans.canLoginIfBanned = async function (uid) {
		let canLogin = true;

		const { banned } = (await User.bans.unbanIfExpired([uid]))[0];
		// Group privilege overshadows individual one
		if (banned) {
			canLogin = await privileges.global.canGroup('local:login', groups.BANNED_USERS);
		}
		if (banned && !canLogin) {
			// Checking a single privilege of user
			canLogin = await groups.isMember(uid, 'cid:0:privileges:local:login');
		}

		return canLogin;
	};

	User.bans.unbanIfExpired = async function (uids) {
		// loading user data will unban if it has expired -barisu
		const userData = await User.getUsersFields(uids, ['banned:expire']);
		return User.bans.calcExpiredFromUserData(userData);
	};

	User.bans.calcExpiredFromUserData = async function (userData) {
		const isArray = Array.isArray(userData);
		userData = isArray ? userData : [userData];
		const banned = await groups.isMembers(userData.map(u => u.uid), groups.BANNED_USERS);
		userData = userData.map((userData, index) => ({
			banned: banned[index],
			'banned:expire': userData && userData['banned:expire'],
			banExpired: userData && userData['banned:expire'] <= Date.now() && userData['banned:expire'] !== 0,
		}));
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
		const keys = await db.getSortedSetRevRange(`uid:${uid}:bans:timestamp`, 0, 0);
		if (!keys.length) {
			return '';
		}
		const banObj = await db.getObject(keys[0]);
		return banObj && banObj.reason ? banObj.reason : '';
	};
};
