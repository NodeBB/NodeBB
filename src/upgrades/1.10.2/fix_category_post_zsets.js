'use strict';

const db = require('../../database');
const posts = require('../../posts');
const topics = require('../../topics');
const batch = require('../../batch');

module.exports = {
	name: 'Fix category post zsets',
	timestamp: Date.UTC(2018, 9, 10),
	method: async function () {
		const { progress } = this;

		const cids = await db.getSortedSetRange('categories:cid', 0, -1);
		const keys = cids.map(cid => `cid:${cid}:pids`);

		await batch.processSortedSet('posts:pid', async (postData) => {
			const pids = postData.map(p => p.value);
			const topicData = await posts.getPostsFields(pids, ['tid']);
			const categoryData = await topics.getTopicsFields(topicData.map(t => t.tid), ['cid']);

			await db.sortedSetRemove(keys, pids);
			const bulkAdd = postData.map((p, i) => ([`cid:${categoryData[i].cid}:pids`, p.score, p.value]));
			await db.sortedSetAddBulk(bulkAdd);
			progress.incr(postData.length);
		}, {
			batch: 500,
			progress: progress,
			withScores: true,
		});
	},
};
