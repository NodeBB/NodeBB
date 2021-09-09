'use strict';

const db = require('../../database');

const batch = require('../../batch');

module.exports = {
	name: 'Store poster count in topic hash',
	timestamp: Date.UTC(2020, 9, 24),
	method: async function () {
		const progress = this.progress;

		await batch.processSortedSet('topics:tid', async function (tids) {
			progress.incr(tids.length);
			const keys = tids.map(tid => 'tid:' + tid + ':posters');
			await db.sortedSetsRemoveRangeByScore(keys, '-inf', 0);
			const counts = await db.sortedSetsCard(keys);
			for (let i = 0; i < tids.length; i++) {
				if (counts[i] > 0) {
					// eslint-disable-next-line no-await-in-loop
					await db.setObjectField('topic:' + tids[i], 'postercount', counts[i]);
				}
			}
		}, {
			progress: progress,
			batchSize: 500,
		});
	},
};
