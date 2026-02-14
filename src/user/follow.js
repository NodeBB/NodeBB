
'use strict';

const notifications = require('../notifications');
const plugins = require('../plugins');
const activitypub = require('../activitypub');
const db = require('../database');
const utils = require('../utils');

module.exports = function (User) {
	User.follow = async function (uid, followuid) {
		await toggleFollow('follow', uid, followuid);
	};

	User.unfollow = async function (uid, unfollowuid) {
		await toggleFollow('unfollow', uid, unfollowuid);
	};

	async function toggleFollow(type, uid, theiruid) {
		if (parseInt(uid, 10) <= 0 || parseInt(theiruid, 10) <= 0) {
			throw new Error('[[error:invalid-uid]]');
		}

		if (parseInt(uid, 10) === parseInt(theiruid, 10)) {
			throw new Error('[[error:you-cant-follow-yourself]]');
		}
		const [exists, isFollowing] = await Promise.all([
			User.exists(theiruid),
			User.isFollowing(uid, theiruid),
		]);
		if (!exists) {
			throw new Error('[[error:no-user]]');
		}

		await plugins.hooks.fire('filter:user.toggleFollow', {
			type,
			uid,
			theiruid,
			isFollowing,
		});

		if (type === 'follow') {
			if (isFollowing) {
				throw new Error('[[error:already-following]]');
			}
			const now = Date.now();
			await db.sortedSetAddBulk([
				[`following:${uid}`, now, theiruid],
				[`followers:${theiruid}`, now, uid],
			]);
		} else {
			if (!isFollowing) {
				throw new Error('[[error:not-following]]');
			}
			await db.sortedSetRemoveBulk([
				[`following:${uid}`, theiruid],
				[`followers:${theiruid}`, uid],
			]);
		}

		const [followingCount, followingRemoteCount, followerCount, followerRemoteCount] = await db.sortedSetsCard([
			`following:${uid}`, `followingRemote:${uid}`, `followers:${theiruid}`, `followersRemote:${theiruid}`,
		]);
		await Promise.all([
			User.setUserField(uid, 'followingCount', followingCount + followingRemoteCount),
			User.setUserField(theiruid, 'followerCount', followerCount + followerRemoteCount),
		]);
	}

	User.getFollowing = async function (uid, start, stop) {
		return await getFollow(uid, 'following', start, stop);
	};

	User.getFollowers = async function (uid, start, stop) {
		return await getFollow(uid, 'followers', start, stop);
	};

	async function getFollow(uid, type, start, stop) {
		if (parseInt(uid, 10) <= 0) {
			return [];
		}
		let uids = await db.getSortedSetRevRange([
			`${type}:${uid}`,
			`${type}Remote:${uid}`,
		], start, stop);

		// Filter out remote categories
		const isCategory = await db.exists(uids.map(uid => `categoryRemote:${uid}`));
		uids = uids.filter((uid, idx) => !isCategory[idx]);

		const data = await plugins.hooks.fire(`filter:user.${type}`, {
			uids: uids,
			uid: uid,
			start: start,
			stop: stop,
		});
		return await User.getUsers(data.uids, uid);
	}

	User.isFollowing = async function (uid, theirid) {
		const isRemote = activitypub.helpers.isUri(theirid);
		if (parseInt(uid, 10) <= 0 || (!isRemote && (theirid, 10) <= 0)) {
			return false;
		}
		const setPrefix = isRemote ? 'followingRemote' : 'following';
		return await db.isSortedSetMember(`${setPrefix}:${uid}`, theirid);
	};

	User.isFollowPending = async function (uid, target) {
		if (utils.isNumber(target)) {
			return false;
		}

		return await db.isSortedSetMember(`followRequests:uid.${uid}`, target);
	};

	User.onFollow = async function (uid, targetUid) {
		const userData = await User.getUserFields(uid, ['username', 'userslug']);
		const { displayname } = userData;

		const notifObj = await notifications.create({
			type: 'follow',
			bodyShort: `[[notifications:user-started-following-you, ${displayname}]]`,
			nid: `follow:${targetUid}:uid:${uid}`,
			from: uid,
			path: `/user/${userData.userslug}`,
			mergeId: 'notifications:user-started-following-you',
		});
		if (!notifObj) {
			return;
		}
		notifObj.user = userData;
		await notifications.push(notifObj, [targetUid]);
	};
};
