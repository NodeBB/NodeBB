'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Clean flag byCid zsets',
	timestamp: Date.UTC(2019, 8, 24),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('flags:datetime', async (flagIds) => {
			progress.incr(flagIds.length);
			const flagData = await db.getObjects(flagIds.map(id => `flag:${id}`));
			const bulkRemove = [];
			for (const flagObj of flagData) {
				if (flagObj && flagObj.type === 'user' && flagObj.targetId && flagObj.flagId) {
					bulkRemove.push([`flags:byCid:${flagObj.targetId}`, flagObj.flagId]);
				}
			}

			await db.sortedSetRemoveBulk(bulkRemove);
		}, {
			progress: progress,
		});
	},
};
