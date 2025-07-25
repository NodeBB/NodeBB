'use strict';

const db = require('../../database');

module.exports = {
	name: 'Add parentPid field to existing posts for threaded replies',
	timestamp: Date.UTC(2025, 6, 24),
	method: async function () {
		const batch = require('../../batch');
		const { progress } = this;

		// Process all posts in batches to add parentPid field (initialized to null/0)
		await batch.processSortedSet('posts:pid', async (pids) => {
			const keys = pids.map(pid => `post:${pid}`);
			const postData = await db.getObjects(keys, ['pid', 'toPid']);
			
			const updateData = [];
			postData.forEach((post) => {
				if (post && post.pid) {
					// If post has toPid, use it as parentPid for backward compatibility
					// Otherwise, set parentPid to null (0 for integer storage)
					const parentPid = post.toPid || 0;
					updateData.push({
						key: `post:${post.pid}`,
						data: { parentPid }
					});
				}
			});

			// Bulk update posts with parentPid field
			const promises = updateData.map(({ key, data }) => db.setObject(key, data));
			await Promise.all(promises);
			
			progress.incr(pids.length);
		}, {
			progress,
			batch: 500,
		});
	},
};