'use strict';


const db = require('../../database');

module.exports = {
	name: 'New sorted set cid:<cid>:tids:create',
	timestamp: Date.UTC(2024, 2, 4),
	method: async function () {
		const { progress } = this;
		const batch = require('../../batch');
		await batch.processSortedSet('topics:tid', async (tids) => {
			let topicData = await db.getObjectsFields(
				tids.map(tid => `topic:${tid}`),
				['tid', 'cid', 'timestamp']
			);
			topicData = topicData.filter(Boolean);
			topicData.forEach((t) => {
				t.timestamp = t.timestamp || Date.now();
			});

			await db.sortedSetAddBulk(
				topicData.map(t => ([`cid:${t.cid}:tids:create`, t.timestamp, t.tid]))
			);

			progress.incr(tids.length);
		}, {
			progress: this.progress,
		});
	},
};
