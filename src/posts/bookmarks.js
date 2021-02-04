'use strict';

const db = require('../database');
const plugins = require('../plugins');

module.exports = function (Posts) {
	Posts.bookmark = async function (pid, uid) {
		return await toggleBookmark('bookmark', pid, uid);
	};

	Posts.unbookmark = async function (pid, uid) {
		return await toggleBookmark('unbookmark', pid, uid);
	};

	async function toggleBookmark(type, pid, uid) {
		if (parseInt(uid, 10) <= 0) {
			throw new Error('[[error:not-logged-in]]');
		}

		const isBookmarking = type === 'bookmark';

		const [postData, hasBookmarked] = await Promise.all([
			Posts.getPostFields(pid, ['pid', 'uid']),
			Posts.hasBookmarked(pid, uid),
		]);

		if (isBookmarking && hasBookmarked) {
			throw new Error('[[error:already-bookmarked]]');
		}

		if (!isBookmarking && !hasBookmarked) {
			throw new Error('[[error:already-unbookmarked]]');
		}

		if (isBookmarking) {
			await db.sortedSetAdd(`uid:${uid}:bookmarks`, Date.now(), pid);
		} else {
			await db.sortedSetRemove(`uid:${uid}:bookmarks`, pid);
		}
		await db[isBookmarking ? 'setAdd' : 'setRemove'](`pid:${pid}:users_bookmarked`, uid);
		postData.bookmarks = await db.setCount(`pid:${pid}:users_bookmarked`);
		await Posts.setPostField(pid, 'bookmarks', postData.bookmarks);

		plugins.hooks.fire(`action:post.${type}`, {
			pid: pid,
			uid: uid,
			owner: postData.uid,
			current: hasBookmarked ? 'bookmarked' : 'unbookmarked',
		});

		return {
			post: postData,
			isBookmarked: isBookmarking,
		};
	}

	Posts.hasBookmarked = async function (pid, uid) {
		if (parseInt(uid, 10) <= 0) {
			return Array.isArray(pid) ? pid.map(() => false) : false;
		}

		if (Array.isArray(pid)) {
			const sets = pid.map(pid => `pid:${pid}:users_bookmarked`);
			return await db.isMemberOfSets(sets, uid);
		}
		return await db.isSetMember(`pid:${pid}:users_bookmarked`, uid);
	};
};
