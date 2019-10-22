'use strict';

const winston = require('winston');
const validator = require('validator');
const util = require('util');
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
		const exists = await db.exists('lockout:' + uid);
		if (exists) {
			throw new Error('[[error:account-locked]]');
		}
		const attempts = await db.increment('loginAttempts:' + uid);
		if (attempts <= meta.config.loginAttempts) {
			return await db.pexpire('loginAttempts:' + uid, 1000 * 60 * 60);
		}
		// Lock out the account
		await db.set('lockout:' + uid, '');
		const duration = 1000 * 60 * meta.config.lockoutDuration;

		await db.delete('loginAttempts:' + uid);
		await db.pexpire('lockout:' + uid, duration);
		events.log({
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
		const _token = await db.getObjectField('user:' + uid, 'rss_token');
		const token = _token || utils.generateUUID();
		if (!_token) {
			await User.setUserField(uid, 'rss_token', token);
		}
		return token;
	};

	User.auth.clearLoginAttempts = async function (uid) {
		await db.delete('loginAttempts:' + uid);
	};

	User.auth.resetLockout = async function (uid) {
		await db.deleteAll([
			'loginAttempts:' + uid,
			'lockout:' + uid,
		]);
	};

	const getSessionFromStore = util.promisify((sid, callback) => db.sessionStore.get(sid, (err, sessObj) => callback(err, sessObj || null)));
	const sessionStoreDestroy = util.promisify((sid, callback) => db.sessionStore.destroy(sid, err => callback(err)));

	User.auth.getSessions = async function (uid, curSessionId) {
		const sids = await db.getSortedSetRevRange('uid:' + uid + ':sessions', 0, 19);
		let sessions = await Promise.all(sids.map(sid => getSessionFromStore(sid)));
		sessions.forEach(function (sessionObj, idx) {
			if (sessionObj && sessionObj.meta) {
				sessionObj.meta.current = curSessionId === sids[idx];
			}
		});

		// Revoke any sessions that have expired, return filtered list
		const expiredSids = [];
		sessions = sessions.filter(function (sessionObj, idx) {
			const expired = !sessionObj || !sessionObj.hasOwnProperty('passport') ||
				!sessionObj.passport.hasOwnProperty('user')	||
				parseInt(sessionObj.passport.user, 10) !== parseInt(uid, 10);

			if (expired) {
				expiredSids.push(sids[idx]);
			}

			return !expired;
		});
		await Promise.all(expiredSids.map(s => User.auth.revokeSession(s, uid)));

		sessions = sessions.map(function (sessObj) {
			if (sessObj.meta) {
				sessObj.meta.datetimeISO = new Date(sessObj.meta.datetime).toISOString();
				sessObj.meta.ip = validator.escape(String(sessObj.meta.ip));
			}
			return sessObj.meta;
		}).filter(Boolean);
		return sessions;
	};

	User.auth.addSession = async function (uid, sessionId) {
		if (!(parseInt(uid, 10) > 0)) {
			return;
		}
		await db.sortedSetAdd('uid:' + uid + ':sessions', Date.now(), sessionId);
	};

	User.auth.revokeSession = async function (sessionId, uid) {
		winston.verbose('[user.auth] Revoking session ' + sessionId + ' for user ' + uid);
		const sessionObj = await getSessionFromStore(sessionId);
		if (sessionObj && sessionObj.meta && sessionObj.meta.uuid) {
			await db.deleteObjectField('uid:' + uid + ':sessionUUID:sessionId', sessionObj.meta.uuid);
		}
		await Promise.all([
			db.sortedSetRemove('uid:' + uid + ':sessions', sessionId),
			sessionStoreDestroy(sessionId),
		]);
	};

	User.auth.revokeAllSessions = async function (uids) {
		uids = Array.isArray(uids) ? uids : [uids];
		const sids = await db.getSortedSetsMembers(uids.map(uid => 'uid:' + uid + ':sessions'));
		const promises = [];
		uids.forEach((uid, index) => {
			promises.push(sids[index].map(s => User.auth.revokeSession(s, uid)));
		});
		await Promise.all(promises);
	};

	User.auth.deleteAllSessions = async function () {
		await batch.processSortedSet('users:joindate', async function (uids) {
			const sessionKeys = uids.map(uid => 'uid:' + uid + ':sessions');
			const sessionUUIDKeys = uids.map(uid => 'uid:' + uid + ':sessionUUID:sessionId');
			const sids = _.flatten(await db.getSortedSetRange(sessionKeys, 0, -1));

			await Promise.all([
				db.deleteAll(sessionKeys.concat(sessionUUIDKeys)),
				...sids.map(sid => sessionStoreDestroy(sid)),
			]);
		}, { batch: 1000 });
	};
};
