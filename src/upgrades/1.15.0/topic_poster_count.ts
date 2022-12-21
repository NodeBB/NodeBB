'use strict';

const db = require('../../database');

const batch = require('../../batch');

module.exports = {
	name: 'Store poster count in topic hash',
	timestamp: Date.UTC(2020, 9, 24),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('topics:tid', async (tids) => {
			progress.incr(tids.length);
			const keys = tids.map(tid => `tid:${tid}:posters`);
			await db.sortedSetsRemoveRangeByScore(keys, '-inf', 0);
			const counts = await db.sortedSetsCard(keys);
			const bulkSet = [];
			for (let i = 0; i < tids.length; i++) {
				if (counts[i] > 0) {
					bulkSet.push([`topic:${tids[i]}`, { postercount: counts[i] }]);
				}
			}
			await db.setObjectBulk(bulkSet);
		}, {
			progress: progress,
			batchSize: 500,
		});
	},
};
