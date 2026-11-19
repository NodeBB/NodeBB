'use strict';

const db = require('../../database');

module.exports = {
	name: 'Store controversial posts in user votes sorted set',
	timestamp: Date.UTC(2026, 10, 19),
	method: async function () {
		// upgrade script taking too long? uncomment this.
		// return;

		const batch = require('../../batch');
		const posts = require('../../posts');
		const { progress } = this;

		await batch.processSortedSet('posts:pid', async (pids) => {
			const postData = await posts.getPostsFields(pids, ['pid', 'uid', 'upvotes', 'downvotes']);
			const cids = await posts.getCidsByPids(pids);

			const bulkAdd = [];
			postData.forEach((post, index) => {
				if (post.downvotes > 0) {
					const cid = cids[index];
					bulkAdd.push([`cid:${cid}:uid:${post.uid}:pids:votesRatio`, post.upvotes / post.downvotes, post.pid]);
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
