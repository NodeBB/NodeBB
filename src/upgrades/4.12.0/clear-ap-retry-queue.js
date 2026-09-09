'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Clear ap:retry:queue entries without digest',
	timestamp: Date.UTC(2026, 4, 20),
	method: async function () {
		const queueIds = await db.getSortedSetRange('ap:retry:queue', 0, -1);
		if (!queueIds.length) {
			return;
		}

		await batch.processArray(queueIds, async (batchIds) => {
			const objects = await db.getObjects(batchIds.map(id => `ap:retry:queue:${id}`));
			const toRemove = [];
			const toDelete = [];

			for (const obj of objects) {
				if (!obj || !obj.digest) {
					toRemove.push(obj.queueId);
					toDelete.push(`ap:retry:queue:${obj.queueId}`);
				}
			}

			if (toRemove.length) {
				await Promise.all([
					db.sortedSetRemove('ap:retry:queue', toRemove),
					db.deleteAll(toDelete),
				]);
			}
		}, {
			batch: 200,
		});
	},
};
