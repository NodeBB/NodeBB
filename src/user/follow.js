
'use strict';

const plugins = require('../plugins');
const db = require('../database');

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

		const [followingCount, followerCount] = await Promise.all([
			db.sortedSetCard(`following:${uid}`),
			db.sortedSetCard(`followers:${theiruid}`),
		]);
		await Promise.all([
			User.setUserField(uid, 'followingCount', followingCount),
			User.setUserField(theiruid, 'followerCount', followerCount),
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
		const uids = await db.getSortedSetRevRange(`${type}:${uid}`, start, stop);
		const data = await plugins.hooks.fire(`filter:user.${type}`, {
			uids: uids,
			uid: uid,
			start: start,
			stop: stop,
		});
		return await User.getUsers(data.uids, uid);
	}

	User.isFollowing = async function (uid, theirid) {
		if (parseInt(uid, 10) <= 0 || parseInt(theirid, 10) <= 0) {
			return false;
		}
		return await db.isSortedSetMember(`following:${uid}`, theirid);
	};
};
