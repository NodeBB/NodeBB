'use strict';

const winston = require('winston');

const db = require('../../database');
const user = require('../../user');
const meta = require('../../meta');
const websockets = require('../index');
const events = require('../../events');
const privileges = require('../../privileges');
const plugins = require('../../plugins');
const emailer = require('../../emailer');
const translator = require('../../translator');
const utils = require('../../../public/src/utils');

module.exports = function (SocketUser) {
	SocketUser.banUsers = async function (socket, data) {
		if (!data || !Array.isArray(data.uids)) {
			throw new Error('[[error:invalid-data]]');
		}

		await toggleBan(socket.uid, data.uids, async function (uid) {
			await banUser(socket.uid, uid, data.until || 0, data.reason || '');
			await events.log({
				type: 'user-ban',
				uid: socket.uid,
				targetUid: uid,
				ip: socket.ip,
				reason: data.reason || undefined,
			});
			plugins.fireHook('action:user.banned', {
				callerUid: socket.uid,
				ip: socket.ip,
				uid: uid,
				until: data.until > 0 ? data.until : undefined,
				reason: data.reason || undefined,
			});
			await user.auth.revokeAllSessions(uid);
		});
	};

	SocketUser.unbanUsers = async function (socket, uids) {
		await toggleBan(socket.uid, uids, async function (uid) {
			await user.bans.unban(uid);
			await events.log({
				type: 'user-unban',
				uid: socket.uid,
				targetUid: uid,
				ip: socket.ip,
			});
			plugins.fireHook('action:user.unbanned', {
				callerUid: socket.uid,
				ip: socket.ip,
				uid: uid,
			});
		});
	};

	async function toggleBan(uid, uids, method) {
		if (!Array.isArray(uids)) {
			throw new Error('[[error:invalid-data]]');
		}
		const hasBanPrivilege = await privileges.users.hasBanPrivilege(uid);
		if (!hasBanPrivilege) {
			throw new Error('[[error:no-privileges]]');
		}

		await Promise.all(uids.map(uid => method(uid)));
	}

	async function banUser(callerUid, uid, until, reason) {
		const isAdmin = await user.isAdministrator(uid);
		if (isAdmin) {
			throw new Error('[[error:cant-ban-other-admins]]');
		}
		const username = await user.getUserField(uid, 'username');
		const siteTitle = meta.config.title || 'NodeBB';
		const data = {
			subject: '[[email:banned.subject, ' + siteTitle + ']]',
			username: username,
			until: until ? utils.toISOString(until) : false,
			reason: reason,
		};
		try {
			await emailer.send('banned', uid, data);
		} catch (err) {
			winston.error('[emailer.send] ' + err.message);
		}
		const banData = await user.bans.ban(uid, until, reason);
		await db.setObjectField('uid:' + uid + ':ban:' + banData.timestamp, 'fromUid', callerUid);

		if (!reason) {
			reason = await translator.translate('[[user:info.banned-no-reason]]');
		}

		websockets.in('uid_' + uid).emit('event:banned', {
			until: until,
			reason: reason,
		});
	}
};
