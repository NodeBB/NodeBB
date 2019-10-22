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
			User.getUserFields(uid, ['uid', 'banned', 'joindate', 'email', 'email:confirmed', 'reputation'].concat([field])),
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

		if (meta.config.requireEmailConfirmation && !userData['email:confirmed']) {
			throw new Error('[[error:email-not-confirmed]]');
		}

		var now = Date.now();
		if (now - userData.joindate < meta.config.initialPostDelay * 1000) {
			throw new Error('[[error:user-too-new, ' + meta.config.initialPostDelay + ']]');
		}

		var lasttime = userData[field] || 0;

		if (meta.config.newbiePostDelay > 0 && meta.config.newbiePostDelayThreshold > userData.reputation && now - lasttime < meta.config.newbiePostDelay * 1000) {
			throw new Error('[[error:too-many-posts-newbie, ' + meta.config.newbiePostDelay + ', ' + meta.config.newbiePostDelayThreshold + ']]');
		} else if (now - lasttime < meta.config.postDelay * 1000) {
			throw new Error('[[error:too-many-posts, ' + meta.config.postDelay + ']]');
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
			'uid:' + postData.uid + ':posts',
			'cid:' + postData.cid + ':uid:' + postData.uid + ':pids',
		], postData.timestamp, postData.pid);
	};

	User.incrementUserPostCountBy = async function (uid, value) {
		const newpostcount = await User.incrementUserFieldBy(uid, 'postcount', value);
		if (parseInt(uid, 10) <= 0) {
			return;
		}
		await db.sortedSetAdd('users:postcount', newpostcount, uid);
	};

	User.getPostIds = async function (uid, start, stop) {
		const pids = await db.getSortedSetRevRange('uid:' + uid + ':posts', start, stop);
		return Array.isArray(pids) ? pids : [];
	};
};
