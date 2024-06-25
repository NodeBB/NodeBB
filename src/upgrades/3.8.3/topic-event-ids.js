/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Add id field to all topic events',
	timestamp: Date.UTC(2024, 5, 24),
	method: async function () {
		const { progress } = this;

		let nextId = await db.getObjectField('global', 'nextTopicEventId');
		nextId = parseInt(nextId, 10) || 0;
		const ids = [];
		for (let i = 1; i < nextId; i++) {
			ids.push(i);
		}
		await batch.processArray(ids, async (eids) => {
			const eventData = await db.getObjects(eids.map(eid => `topicEvent:${eid}`));
			const bulkSet = [];
			eventData.forEach((event, idx) => {
				if (event && event.type) {
					const id = eids[idx];
					bulkSet.push(
						[`topicEvent:${id}`, { id: id }]
					);
				}
			});
			await db.setObjectBulk(bulkSet);
			progress.incr(eids.length);
		}, {
			batch: 500,
			progress,
		});
	},
};
