'use strict';

const batch = require('../../batch');
const db = require('../../database');

module.exports = {
	name: 'Fix topics in categories per user if they were moved',
	timestamp: Date.UTC(2018, 0, 22),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('topics:tid', async (tids) => {
			await Promise.all(tids.map(async (tid) => {
				progress.incr();
				const topicData = await db.getObjectFields(`topic:${tid}`, ['cid', 'tid', 'uid', 'oldCid', 'timestamp']);
				if (topicData.cid && topicData.oldCid) {
					const isMember = await db.isSortedSetMember(`cid:${topicData.oldCid}:uid:${topicData.uid}:tids`, topicData.tid);
					if (isMember) {
						await db.sortedSetRemove(`cid:${topicData.oldCid}:uid:${topicData.uid}:tids`, tid);
						await db.sortedSetAdd(`cid:${topicData.cid}:uid:${topicData.uid}:tids`, topicData.timestamp, tid);
					}
				}
			}));
		}, {
			progress: progress,
			batch: 500,
		});
	},
};
