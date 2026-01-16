'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'New sorted set cid:<cid>:tids:lastposttime',
	timestamp: Date.UTC(2017, 9, 30),
	method: async function () {
		const { progress } = this;
		progress.total = await db.sortedSetCard('topics:tid');

		await batch.processSortedSet('topics:tid', async (tids) => {
			const topicData = await db.getObjectsFields(
				tids.map(tid => `topic:${tid}`), ['tid', 'cid', 'timestamp', 'lastposttime']
			);
			const bulkAdd = [];
			topicData.forEach((data) => {
				if (data && data.cid && data.tid) {
					const timestamp = data.lastposttime || data.timestamp || Date.now();
					bulkAdd.push([`cid:${data.cid}:tids:lastposttime`, timestamp, data.tid]);
				}
			});
			await db.sortedSetAddBulk(bulkAdd);
			progress.incr(tids.length);
		}, {
			batch: 500,
		});
	},
};
