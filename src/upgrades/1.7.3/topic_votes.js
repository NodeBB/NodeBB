'use strict';


const batch = require('../../batch');
const db = require('../../database');

module.exports = {
	name: 'Add votes to topics',
	timestamp: Date.UTC(2017, 11, 8),
	method: async function () {
		const { progress } = this;

		progress.total = await db.sortedSetCard('topics:tid');

		await batch.processSortedSet('topics:tid', async (tids) => {
			const topicsData = await db.getObjectsFields(
				tids.map(tid => `topic:${tid}`),
				['tid', 'mainPid', 'cid', 'pinned'],
			);
			const mainPids = topicsData.map(topicData => topicData && topicData.mainPid);
			const mainPosts = await db.getObjects(mainPids.map(pid => `post:${pid}`));

			const bulkSet = [];
			const bulkAdd = [];

			topicsData.forEach((topicData, index) => {
				const mainPost = mainPosts[index];
				if (mainPost && topicData && topicData.cid) {
					const upvotes = parseInt(mainPost.upvotes, 10) || 0;
					const downvotes = parseInt(mainPost.downvotes, 10) || 0;
					const data = {
						upvotes: upvotes,
						downvotes: downvotes,
					};
					const votes = upvotes - downvotes;
					bulkSet.push([`topic:${topicData.tid}`, data]);
					bulkAdd.push(['topics:votes', votes, topicData.tid]);
					if (parseInt(topicData.pinned, 10) !== 1) {
						bulkAdd.push([`cid:${topicData.cid}:tids:votes`, votes, topicData.tid]);
					}
				}
			});

			await db.setObjectBulk(bulkSet);
			await db.sortedSetAddBulk('topics:votes', bulkAdd);

			progress.incr(tids.length);
		}, {
			batch: 500,
		});
	},
};
