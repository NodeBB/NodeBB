
'use strict';

const async = require('async');

const db = require('../database');
const user = require('../user');

module.exports = function (Topics) {
	Topics.getUserBookmark = async function (tid, uid) {
		if (parseInt(uid, 10) <= 0) {
			return null;
		}
		return await db.sortedSetScore(`tid:${tid}:bookmarks`, uid);
	};

	Topics.getUserBookmarks = async function (tids, uid) {
		if (parseInt(uid, 10) <= 0) {
			return tids.map(() => null);
		}
		return await db.sortedSetsScore(tids.map(tid => `tid:${tid}:bookmarks`), uid);
	};

	Topics.setUserBookmark = async function (tid, uid, index) {
		if (parseInt(uid, 10) <= 0) {
			return;
		}
		await db.sortedSetAdd(`tid:${tid}:bookmarks`, index, uid);
	};

	Topics.getTopicBookmarks = async function (tid) {
		return await db.getSortedSetRangeWithScores(`tid:${tid}:bookmarks`, 0, -1);
	};

	Topics.updateTopicBookmarks = async function (tid, pids) {
		const maxIndex = await Topics.getPostCount(tid);
		const indices = await db.sortedSetRanks(`tid:${tid}:posts`, pids);
		const postIndices = indices.map(i => (i === null ? 0 : i + 1));
		const minIndex = Math.min(...postIndices);

		const bookmarks = await Topics.getTopicBookmarks(tid);

		const uidData = bookmarks.map(b => ({ uid: b.value, bookmark: parseInt(b.score, 10) }))
			.filter(data => data.bookmark >= minIndex);

		await async.eachLimit(uidData, 50, async (data) => {
			let bookmark = Math.min(data.bookmark, maxIndex);

			postIndices.forEach((i) => {
				if (i < data.bookmark) {
					bookmark -= 1;
				}
			});

			// make sure the bookmark is valid if we removed the last post
			bookmark = Math.min(bookmark, maxIndex - pids.length);
			if (bookmark === data.bookmark) {
				return;
			}

			const settings = await user.getSettings(data.uid);
			if (settings.topicPostSort === 'most_votes') {
				return;
			}

			await Topics.setUserBookmark(tid, data.uid, bookmark);
		});
	};
};
