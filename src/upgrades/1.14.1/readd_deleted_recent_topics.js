'use strict';

const db = require('../../database');

const batch = require('../../batch');

module.exports = {
	name: 'Re-add deleted topics to topics:recent',
	timestamp: Date.UTC(2018, 9, 11),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('topics:tid', async (tids) => {
			progress.incr(tids.length);
			const topicData = await db.getObjectsFields(
				tids.map(tid => `topic:${tid}`),
				['tid', 'lastposttime', 'viewcount', 'postcount', 'upvotes', 'downvotes']
			);
			if (!topicData.tid) {
				return;
			}
			topicData.forEach((t) => {
				if (t.hasOwnProperty('upvotes') && t.hasOwnProperty('downvotes')) {
					t.votes = parseInt(t.upvotes, 10) - parseInt(t.downvotes, 10);
				}
			});

			await db.sortedSetAdd(
				'topics:recent',
				topicData.map(t => t.lastposttime || 0),
				topicData.map(t => t.tid)
			);

			await db.sortedSetAdd(
				'topics:views',
				topicData.map(t => t.viewcount || 0),
				topicData.map(t => t.tid)
			);

			await db.sortedSetAdd(
				'topics:posts',
				topicData.map(t => t.postcount || 0),
				topicData.map(t => t.tid)
			);

			await db.sortedSetAdd(
				'topics:votes',
				topicData.map(t => t.votes || 0),
				topicData.map(t => t.tid)
			);
		}, {
			progress: progress,
			batchSize: 500,
		});
	},
};
