'use strict';

import db from '../../database';

export default  {
	name: 'Store downvoted posts in user votes sorted set',
	timestamp: Date.UTC(2022, 1, 4),
	method: async function () {
		const batch = require('../../batch');
		const posts = require('../../posts');
		const { progress } = this as any;

		await batch.processSortedSet('posts:pid', async (pids) => {
			const postData = await posts.getPostsFields(pids, ['pid', 'uid', 'upvotes', 'downvotes']);
			const cids = await posts.getCidsByPids(pids);

			const bulkAdd : any[] = [];
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
