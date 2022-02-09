'use strict';

const db = require('../../database');

module.exports = {
	name: 'Store downvoted posts in user votes sorted set',
	timestamp: Date.UTC(2022, 1, 4),
	method: async function () {
		const batch = require('../../batch');
		const posts = require('../../posts');
		const { progress } = this;

		await batch.processSortedSet('posts:pid', async (pids) => {
			const postData = await posts.getPostsFields(pids, ['pid', 'uid', 'upvotes', 'downvotes']);
			const cids = await posts.getCidsByPids(pids);

			const bulkAdd = [];
			postData.forEach((post, index) => {
				if (post.votes > 0 || post.votes < 0) {
					const cid = cids[index];
					bulkAdd.push([`cid:${cid}:uid:${post.uid}:pids:votes`, post.votes, post.pid]);
				}
			});
			await db.sortedSetAddBulk(bulkAdd);
			progress.incr(postData.length);
		}, {
			progress,
			batch: 500,
		});
	},
};
