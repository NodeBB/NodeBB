'use strict';

const batch = require('../../batch');
const db = require('../../database');

module.exports = {
	name: 'Fix sort by votes for moved topics',
	timestamp: Date.UTC(2018, 0, 8),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('topics:tid', async (tids) => {
			await Promise.all(tids.map(async (tid) => {
				progress.incr();
				const topicData = await db.getObjectFields(`topic:${tid}`, ['cid', 'oldCid', 'upvotes', 'downvotes', 'pinned']);
				if (topicData.cid && topicData.oldCid) {
					const upvotes = parseInt(topicData.upvotes, 10) || 0;
					const downvotes = parseInt(topicData.downvotes, 10) || 0;
					const votes = upvotes - downvotes;
					await db.sortedSetRemove(`cid:${topicData.oldCid}:tids:votes`, tid);
					if (parseInt(topicData.pinned, 10) !== 1) {
						await db.sortedSetAdd(`cid:${topicData.cid}:tids:votes`, votes, tid);
					}
				}
			}));
		}, {
			progress: progress,
			batch: 500,
		});
	},
};
