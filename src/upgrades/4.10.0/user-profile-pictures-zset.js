'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Add uid:<uid>:profile:pictures zset',
	timestamp: Date.UTC(2026, 2, 13),
	method: async function () {
		const { progress } = this;
		await batch.processSortedSet('users:joindate', async (uids) => {
			const userData = await db.getObjects(uids.map(uid => `user:${uid}`));
			const now = Date.now();
			const bulkAdd = userData.filter(u => u && u.uploadedpicture)
				.map(u => ([`uid:${u.uid}:profile:pictures`, now, u.uploadedpicture]));
			await db.sortedSetAddBulk(bulkAdd);
			progress.incr(uids.length);
		}, {
			batch: 500,
			progress,
		});
	},
};
