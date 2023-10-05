/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Update translation keys in notification bodyShort',
	timestamp: Date.UTC(2023, 9, 5),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet(`notifications`, async (nids) => {
			const notifData = await db.getObjects(nids.map(nid => `notifications:${nid}`));
			notifData.forEach((n) => {
				if (n && n.bodyShort) {
					n.bodyShort = n.bodyShort.replace(/_/g, '-');
				}
			});

			const bulkSet = notifData.map(
				n => [`notifications:${n.nid}`, { bodyShort: n.bodyShort }]
			);

			await db.setObjectBulk(bulkSet);
		}, {
			batch: 500,
			progress: progress,
		});
	},
};
