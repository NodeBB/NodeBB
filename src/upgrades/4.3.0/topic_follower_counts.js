'use strict';

const db = require('../../database');
const batch = require('../../batch');


module.exports = {
	name: 'Set "followercount" on each topic object',
	timestamp: Date.UTC(2025, 3, 15),
	method: async function () {
		const { progress } = this;

		progress.total = await db.sortedSetCard('topics:tid');

		await batch.processSortedSet('topics:tid', async (tids) => {
			const keys = tids.map(tid => `tid:${tid}:followers`);
			const followerCounts = await db.setsCount(keys);

			const bulkSet = [];

			followerCounts.forEach((count, idx) => {
				const tid = tids[idx];
				if (count > 0) {
					bulkSet.push([`topic:${tid}`, {followercount: count}]);
				}
			});

			await db.setObjectBulk(bulkSet);

			progress.incr(tids.length);
		}, {
			batch: 500,
		});
	},
};
