
'use strict';

const db = require('../../database');

module.exports = {
	name: 'Add id field to all topic events',
	timestamp: Date.UTC(2024, 5, 24),
	method: async function () {
		const { progress } = this;

		let nextId = await db.getObjectField('global', 'nextTopicEventId');
		nextId = parseInt(nextId, 10) || 0;
		progress.total = Math.max(0, nextId - 1);
		const ids = [];
		const BATCH_SIZE = 500;

		async function processBatch(eids) {
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
		}

		for (let i = 1; i < nextId; i++) {
			ids.push(i);
			if (ids.length >= BATCH_SIZE) {
				// eslint-disable-next-line no-await-in-loop
				await processBatch(ids);
				progress.incr(ids.length);
				ids.length = 0;
			}
		}

		if (ids.length > 0) {
			await processBatch(ids);
			progress.incr(ids.length);
		}
	},
};
