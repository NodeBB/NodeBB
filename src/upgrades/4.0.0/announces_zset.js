'use strict';

const db = require('../../database');
const batch = require('../../batch');
const topics = require('../../topics');

module.exports = {
	name: 'Save ActivityPub Announces in their own per-post sorted set',
	timestamp: Date.UTC(2024, 4, 1),
	method: async function () {
		const { progress } = this;
		const bulkOp = [];

		await batch.processSortedSet('topics:tid', async (tids, next) => {
			await Promise.all(tids.map(async (tid) => {
				const announces = await topics.events.find(tid, {
					type: 'announce',
				});

				if (announces.length) {
					await Promise.all(announces.map(async (eid) => {
						const event = await db.getObject(`topicEvent:${eid}`);
						if (['uid', 'pid', 'timestamp'].every(prop => event.hasOwnProperty(prop))) {
							bulkOp.push([`pid:${event.pid}:announces`, event.timestamp, event.uid]);
						}
					}));

					await topics.events.purge(tid, announces);
				}
			}));

			progress.incr(tids.length);
		}, { progress });

		await db.sortedSetAddBulk(bulkOp);
	},
};
