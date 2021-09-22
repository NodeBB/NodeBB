/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');

const batch = require('../../batch');

module.exports = {
	name: 'add filters to events',
	timestamp: Date.UTC(2018, 9, 4),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('events:time', async (eids) => {
			for (const eid of eids) {
				progress.incr();

				const eventData = await db.getObject(`event:${eid}`);
				if (!eventData) {
					await db.sortedSetRemove('events:time', eid);
					return;
				}
				// privilege events we're missing type field
				if (!eventData.type && eventData.privilege) {
					eventData.type = 'privilege-change';
					await db.setObjectField(`event:${eid}`, 'type', 'privilege-change');
					await db.sortedSetAdd(`events:time:${eventData.type}`, eventData.timestamp, eid);
					return;
				}
				await db.sortedSetAdd(`events:time:${eventData.type || ''}`, eventData.timestamp, eid);
			}
		}, {
			progress: this.progress,
		});
	},
};
