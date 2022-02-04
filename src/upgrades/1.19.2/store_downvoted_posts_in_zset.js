'use strict';

const db = require('../../database');

module.exports = {
	name: 'Store downvoted posts in user votes sorted set',
	timestamp: Date.UTC(2022, 1, 4),
	method: async function () {
		const batch = require('../../batch');
		const posts = require('../../posts');
		const { progress } = this;

		await batch.processSortedSet('posts:pid', async (ids) => {
			const postData = await posts.getPostsFields(ids, ['uid', 'downvotes']);
			const cids = await posts.getCidsByPids(ids);

			const promises = ids.reduce((memo, pid, idx) => {
				const { uid, downvotes } = postData[idx];
				const cid = cids[idx];

				if (!downvotes) {
					progress.incr();
					return memo;
				}

				memo.push(db.sortedSetAdd(`cid:${cid}:uid:${uid}:pids:votes`, -downvotes, pid));
				return memo;
			}, []);

			await Promise.all(promises);
			progress.incr(promises.length);
		}, {
			progress,
		});
	},
};
