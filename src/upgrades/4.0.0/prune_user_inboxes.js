'use strict';

const db = require('../../database');
const batch = require('../../batch');
const topics = require('../../topics');

module.exports = {
	name: 'Prune deleted topics out of user inboxes',
	timestamp: Date.UTC(2024, 6, 12),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('users:joindate', async (uids) => {
			const exists = await db.exists(uids.map(uid => `uid:${uid}:inbox`));
			const count = uids.length;
			uids = uids.filter((uid, idx) => exists[idx]);

			await Promise.all(uids.map(async (uid) => {
				const key = `uid:${uid}:inbox`;
				const tids = await db.getSortedSetMembers(key);
				const exists = await topics.exists(tids);
				const toRemove = tids.filter((tid, idx) => !exists[idx]);
				await db.sortedSetRemove(key, toRemove);
			}));

			progress.incr(count);
		}, { progress });
	},
};
