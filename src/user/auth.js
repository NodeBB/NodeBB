'use strict';

const validator = require('validator');
const _ = require('lodash');
const db = require('../database');
const meta = require('../meta');
const events = require('../events');
const batch = require('../batch');
const utils = require('../utils');

module.exports = function (User) {
	User.auth = {};

	User.auth.logAttempt = async function (uid, ip) {
		if (!(parseInt(uid, 10) > 0)) {
			return;
		}
		const exists = await db.exists(`lockout:${uid}`);
		if (exists) {
			throw new Error('[[error:account-locked]]');
		}
		const attempts = await db.increment(`loginAttempts:${uid}`);
		if (attempts <= meta.config.loginAttempts) {
			return await db.pexpire(`loginAttempts:${uid}`, 1000 * 60 * 60);
		}
		// Lock out the account
		await db.set(`lockout:${uid}`, '');
		const duration = 1000 * 60 * meta.config.lockoutDuration;

		await db.delete(`loginAttempts:${uid}`);
		await db.pexpire(`lockout:${uid}`, duration);
		await events.log({
			type: 'account-locked',
			uid: uid,
			ip: ip,
		});
		throw new Error('[[error:account-locked]]');
	};

	User.auth.getFeedToken = async function (uid) {
		if (!(parseInt(uid, 10) > 0)) {
			return;
		}
		const _token = await db.getObjectField(`user:${uid}`, 'rss_token');
		const token = _token || utils.generateUUID();
		if (!_token) {
			await User.setUserField(uid, 'rss_token', token);
		}
		return token;
	};

	User.auth.clearLoginAttempts = async function (uid) {
		await db.delete(`loginAttempts:${uid}`);
	};

	User.auth.resetLockout = async function (uid) {
		await db.deleteAll([
			`loginAttempts:${uid}`,
			`lockout:${uid}`,
		]);
	};

	User.auth.getSessions = async function (uid, curSessionId) {
		await cleanExpiredSessions(uid);
		const sids = await db.getSortedSetRevRange(`uid:${uid}:sessions`, 0, 19);
		let sessions = await Promise.all(sids.map(sid => db.sessionStoreGet(sid)));
		sessions = sessions.map((sessObj, idx) => {
			if (sessObj && sessObj.meta) {
				sessObj.meta.current = curSessionId === sids[idx];
				sessObj.meta.datetimeISO = new Date(sessObj.meta.datetime).toISOString();
				sessObj.meta.ip = validator.escape(String(sessObj.meta.ip));
			}
			return sessObj && sessObj.meta;
		}).filter(Boolean);
		return sessions;
	};

	async function cleanExpiredSessions(uid) {
		const sids = await db.getSortedSetRange(`uid:${uid}:sessions`, 0, -1);
		if (!sids.length) {
			return [];
		}

		const expiredSids = [];
		const activeSids = [];
		await Promise.all(sids.map(async (sid) => {
			const sessionObj = await db.sessionStoreGet(sid);
			const expired = !sessionObj || !sessionObj.hasOwnProperty('passport') ||
				!sessionObj.passport.hasOwnProperty('user') ||
				parseInt(sessionObj.passport.user, 10) !== parseInt(uid, 10);
			if (expired) {
				expiredSids.push(sid);
			} else {
				activeSids.push(sid);
			}
		}));

		await db.sortedSetRemove(`uid:${uid}:sessions`, expiredSids);
		return activeSids;
	}

	User.auth.addSession = async function (uid, sessionId) {
		if (!(parseInt(uid, 10) > 0)) {
			return;
		}

		const activeSids = await cleanExpiredSessions(uid);
		await db.sortedSetAdd(`uid:${uid}:sessions`, Date.now(), sessionId);
		await revokeSessionsAboveThreshold(activeSids.push(sessionId), uid);
	};

	async function revokeSessionsAboveThreshold(activeSids, uid) {
		if (meta.config.maxUserSessions > 0 && activeSids.length > meta.config.maxUserSessions) {
			const sessionsToRevoke = activeSids.slice(0, activeSids.length - meta.config.maxUserSessions);
			await User.auth.revokeSession(sessionsToRevoke, uid);
		}
	}

	User.auth.revokeSession = async function (sessionIds, uid) {
		sessionIds = Array.isArray(sessionIds) ? sessionIds : [sessionIds];
		const destroySids = sids => Promise.all(sids.map(db.sessionStoreDestroy));

		await Promise.all([
			db.sortedSetRemove(`uid:${uid}:sessions`, sessionIds),
			destroySids(sessionIds),
		]);
	};

	User.auth.revokeAllSessions = async function (uids, except) {
		uids = Array.isArray(uids) ? uids : [uids];
		const sids = await db.getSortedSetsMembers(uids.map(uid => `uid:${uid}:sessions`));
		const promises = [];
		uids.forEach((uid, index) => {
			const ids = sids[index].filter(id => id !== except);
			if (ids.length) {
				promises.push(User.auth.revokeSession(ids, uid));
			}
		});
		await Promise.all(promises);
	};

	User.auth.deleteAllSessions = async function () {
		await batch.processSortedSet('users:joindate', async (uids) => {
			const sessionKeys = uids.map(uid => `uid:${uid}:sessions`);
			const sids = _.flatten(await db.getSortedSetRange(sessionKeys, 0, -1));

			await Promise.all([
				db.deleteAll(sessionKeys),
				...sids.map(sid => db.sessionStoreDestroy(sid)),
			]);
		}, { batch: 1000 });
	};
};
