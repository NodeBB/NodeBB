'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Add users:muted zset',
	timestamp: Date.UTC(2026, 4, 8),
	method: async function () {
		const { progress } = this;
		await batch.processSortedSet('users:joindate', async (uids) => {
			const userData = await db.getObjects(uids.map(uid => `user:${uid}`));
			const now = Date.now();
			const mutedUserData = userData.filter(
				u => u && u.mutedReason && (u.mutedUntil > now || parseInt(u.mutedUntil, 10) === 0)
			);
			const bulkAdd = mutedUserData.map(u => (['users:muted', now, u.uid]));
			const bulkSet = mutedUserData.map(u => ([`user:${u.uid}`, { muted: 1 }]));

			await db.setObjectBulk(bulkSet);
			await db.sortedSetAddBulk(bulkAdd);
			progress.incr(uids.length);
		}, {
			batch: 500,
			progress,
		});
	},
};
