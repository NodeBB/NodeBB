/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Add user filter to acp events',
	timestamp: Date.UTC(2024, 3, 1),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet(`events:time`, async (eids) => {
			const eventData = await db.getObjects(eids.map(eid => `event:${eid}`));
			const bulkAdd = [];
			eventData.forEach((event) => {
				if (event && event.hasOwnProperty('uid') && event.uid && event.eid) {
					bulkAdd.push(
						[`events:time:uid:${event.uid}`, event.timestamp || Date.now(), event.eid]
					);
				}
			});
			await db.sortedSetAddBulk(bulkAdd);
			progress.incr(eids.length);
		}, {
			batch: 500,
			progress,
		});
	},
};
