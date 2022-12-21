'use strict';

const db = require('../database');
const topics = require('../topics');
const plugins = require('../plugins');
const meta = require('../meta');

module.exports = function (User) {
	User.updateLastOnlineTime = async function (uid) {
		if (!(parseInt(uid, 10) > 0)) {
			return;
		}
		const userData = await db.getObjectFields(`user:${uid}`, ['status', 'lastonline']);
		const now = Date.now();
		if (userData.status === 'offline' || now - parseInt(userData.lastonline, 10) < 300000) {
			return;
		}
		await User.setUserField(uid, 'lastonline', now);
	};

	User.updateOnlineUsers = async function (uid) {
		if (!(parseInt(uid, 10) > 0)) {
			return;
		}
		const now = Date.now();
		const userOnlineTime = await db.sortedSetScore('users:online', uid);
		if (now - parseInt(userOnlineTime, 10) < 300000) {
			return;
		}
		await db.sortedSetAdd('users:online', now, uid);
		topics.pushUnreadCount(uid);
		plugins.hooks.fire('action:user.online', { uid: uid, timestamp: now });
	};

	User.isOnline = async function (uid) {
		const now = Date.now();
		const isArray = Array.isArray(uid);
		uid = isArray ? uid : [uid];
		const lastonline = await db.sortedSetScores('users:online', uid);
		const isOnline = uid.map((uid, index) => (now - lastonline[index]) < (meta.config.onlineCutoff * 60000));
		return isArray ? isOnline : isOnline[0];
	};
};
