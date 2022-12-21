
'use strict';


const db = require('../../database');
const batch = require('../../batch');
const posts = require('../../posts');
const topics = require('../../topics');

module.exports = {
	name: 'Create zsets for user posts per category',
	timestamp: Date.UTC(2019, 5, 23),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('posts:pid', async (pids) => {
			progress.incr(pids.length);
			const postData = await posts.getPostsFields(pids, ['pid', 'uid', 'tid', 'upvotes', 'downvotes', 'timestamp']);
			const tids = postData.map(p => p.tid);
			const topicData = await topics.getTopicsFields(tids, ['cid']);
			const bulk = [];
			postData.forEach((p, index) => {
				if (p && p.uid && p.pid && p.tid && p.timestamp) {
					bulk.push([`cid:${topicData[index].cid}:uid:${p.uid}:pids`, p.timestamp, p.pid]);
					if (p.votes > 0) {
						bulk.push([`cid:${topicData[index].cid}:uid:${p.uid}:pids:votes`, p.votes, p.pid]);
					}
				}
			});
			await db.sortedSetAddBulk(bulk);
		}, {
			progress: progress,
		});
	},
};
