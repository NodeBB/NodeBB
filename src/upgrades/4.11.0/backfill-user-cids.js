'use strict';

const db = require('../../database');
const posts = require('../../posts');
const batch = require('../../batch');

module.exports = {
	name: 'Backfill user posted categories',
	timestamp: Date.UTC(2026, 2, 20),
	method: async function () {
		const { progress } = this;
		await batch.processSortedSet('posts:pid', async (pids) => {
			const postData = await db.getObjectsFields(pids.map(pid => `post:${pid}`), ['uid']);
			const cids = await posts.getCidsByPids(pids);
			const uidPostCountByCid = Object.create(null);
			postData.forEach((post, idx) => {
				const cid = cids[idx];
				uidPostCountByCid[post.uid] = uidPostCountByCid[post.uid] || {};
				uidPostCountByCid[post.uid][cid] = (uidPostCountByCid[post.uid][cid] || 0) + 1;
			});
			const bulkIncr = [];
			Object.keys(uidPostCountByCid).forEach((uid) => {
				Object.keys(uidPostCountByCid[uid]).forEach((cid) => {
					bulkIncr.push([`uid:${uid}:cids`, uidPostCountByCid[uid][cid], cid]);
				});
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
