'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Delete pruned tids from user inboxes and delete tid:<tid>:recipients sorted sets',
	timestamp: Date.UTC(2026, 2, 5),
	method: async function () {
		const { progress } = this;
		progress.total = await db.sortedSetCard('users:joindate');

		await batch.processSortedSet('users:joindate', async (uids) => {
			const userInboxes = await db.getSortedSetsMembers(uids.map(uid => `uid:${uid}:inbox`));
			const exists = await Promise.all(
				userInboxes.map(userTids => db.exists(userTids.map(tid => `topic:${tid}`)))
			);

			const bulkRemove = [];
			const deleteTids = new Set();
			uids.forEach((uid, index) => {
				const userTids = userInboxes[index];
				userTids.forEach((tid, tidIndex) => {
					if (!exists[index][tidIndex]) {
						bulkRemove.push([`uid:${uid}:inbox`, tid]);
						deleteTids.add(tid);
					}
				});
			});
			await db.deleteAll(Array.from(deleteTids).map(tid => `tid:${tid}:recipients`));
			progress.incr(uids.length);
		}, {
			batch: 500,
		});
	},
};
