'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Move post:<pid>:uploads to post hash',
	timestamp: Date.UTC(2025, 6, 5),
	method: async function () {
		const { progress } = this;

		const postCount = await db.sortedSetCard('posts:pid');
		progress.total = postCount;

		await batch.processSortedSet('posts:pid', async (pids) => {
			const keys = pids.map(pid => `post:${pid}:uploads`);

			const postUploadData = await db.getSortedSetsMembersWithScores(keys);

			const bulkSet = [];
			postUploadData.forEach((postUploads, idx) => {
				const pid = pids[idx];
				if (Array.isArray(postUploads) && postUploads.length > 0) {
					bulkSet.push([
						`post:${pid}`,
						{ uploads: JSON.stringify(postUploads.map(upload => upload.value)) },
					]);
				}
			});

			await db.setObjectBulk(bulkSet);
			await db.deleteAll(keys);

			progress.incr(pids.length);
		}, {
			batch: 500,
		});
	},
};
