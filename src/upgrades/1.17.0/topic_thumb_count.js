'use strict';

const _ = require('lodash');
const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Store number of thumbs a topic has in the topic object',
	timestamp: Date.UTC(2021, 1, 7),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('topics:tid', async (tids) => {
			const keys = tids.map(tid => `topic:${tid}:thumbs`);
			const counts = await db.sortedSetsCard(keys);
			const tidToCount = _.zipObject(tids, counts);
			const tidsWithThumbs = tids.filter((t, i) => counts[i] > 0);
			await db.setObjectBulk(
				tidsWithThumbs.map(tid => [`topic:${tid}`, { numThumbs: tidToCount[tid] }]),
			);

			progress.incr(tids.length);
		}, {
			batch: 500,
			progress: progress,
		});
	},
};
