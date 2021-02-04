'use strict';

const db = require('../database');
const meta = require('../meta');
const privileges = require('../privileges');

module.exports = function (User) {
	User.isReadyToPost = async function (uid, cid) {
		await isReady(uid, cid, 'lastposttime');
	};

	User.isReadyToQueue = async function (uid, cid) {
		await isReady(uid, cid, 'lastqueuetime');
	};

	async function isReady(uid, cid, field) {
		if (parseInt(uid, 10) === 0) {
			return;
		}
		const [userData, isAdminOrMod] = await Promise.all([
			User.getUserFields(uid, ['uid', 'banned', 'joindate', 'email', 'reputation'].concat([field])),
			privileges.categories.isAdminOrMod(cid, uid),
		]);

		if (!userData.uid) {
			throw new Error('[[error:no-user]]');
		}

		if (isAdminOrMod) {
			return;
		}

		if (userData.banned) {
			throw new Error('[[error:user-banned]]');
		}

		const now = Date.now();
		if (now - userData.joindate < meta.config.initialPostDelay * 1000) {
			throw new Error(`[[error:user-too-new, ${meta.config.initialPostDelay}]]`);
		}

		const lasttime = userData[field] || 0;

		if (meta.config.newbiePostDelay > 0 && meta.config.newbiePostDelayThreshold > userData.reputation && now - lasttime < meta.config.newbiePostDelay * 1000) {
			throw new Error(`[[error:too-many-posts-newbie, ${meta.config.newbiePostDelay}, ${meta.config.newbiePostDelayThreshold}]]`);
		} else if (now - lasttime < meta.config.postDelay * 1000) {
			throw new Error(`[[error:too-many-posts, ${meta.config.postDelay}]]`);
		}
	}

	User.onNewPostMade = async function (postData) {
		await User.addPostIdToUser(postData);
		await User.incrementUserPostCountBy(postData.uid, 1);
		await User.setUserField(postData.uid, 'lastposttime', postData.timestamp);
		await User.updateLastOnlineTime(postData.uid);
	};

	User.addPostIdToUser = async function (postData) {
		await db.sortedSetsAdd([
			`uid:${postData.uid}:posts`,
			`cid:${postData.cid}:uid:${postData.uid}:pids`,
		], postData.timestamp, postData.pid);
	};

	User.incrementUserPostCountBy = async function (uid, value) {
		return await incrementUserFieldAndSetBy(uid, 'postcount', 'users:postcount', value);
	};

	User.incrementUserReputationBy = async function (uid, value) {
		return await incrementUserFieldAndSetBy(uid, 'reputation', 'users:reputation', value);
	};

	User.incrementUserFlagsBy = async function (uid, value) {
		return await incrementUserFieldAndSetBy(uid, 'flags', 'users:flags', value);
	};

	async function incrementUserFieldAndSetBy(uid, field, set, value) {
		value = parseInt(value, 10);
		if (!value || !field || !(parseInt(uid, 10) > 0)) {
			return;
		}
		const exists = await User.exists(uid);
		if (!exists) {
			return;
		}
		const newValue = await User.incrementUserFieldBy(uid, field, value);
		await db.sortedSetAdd(set, newValue, uid);
		return newValue;
	}

	User.getPostIds = async function (uid, start, stop) {
		const pids = await db.getSortedSetRevRange(`uid:${uid}:posts`, start, stop);
		return Array.isArray(pids) ? pids : [];
	};
};
