'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Backfill user posted categories',
	timestamp: Date.UTC(2026, 2, 20),
	method: async function () {
		const { progress } = this;
		await batch.processSortedSet('posts:pid', async (pids) => {
			const postData = await db.getObjectsFields(pids.map(pid => `post:${pid}`), ['uid', 'cid']);
			const bulkIncr = [];
			postData.forEach((post) => {
				if (post && post.uid && post.cid) {
					bulkIncr.push([`uid:${post.uid}:cids`, 1, post.cid]);
				}
			});

			if (bulkIncr.length) {
				await db.sortedSetIncrByBulk(bulkIncr);
			}

			progress.incr(pids.length);
		}, {
			batch: 500,
			progress,
		});
	},
};
