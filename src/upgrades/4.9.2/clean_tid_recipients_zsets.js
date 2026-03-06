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
			uids.forEach((uid, index) => {
				const userTids = userInboxes[index];
				userTids.forEach((tid, tidIndex) => {
					if (!exists[index][tidIndex]) {
						bulkRemove.push([`uid:${uid}:inbox`, tid]);
					}
				});
			});
			await db.sortedSetRemoveBulk(bulkRemove);

			progress.incr(uids.length);
		}, {
			batch: 500,
		});


		const tidKeys = await db.scan({ match: 'tid:*:recipients' });
		progress.total = tidKeys.length;
		progress.current = 0;
		progress.counter = 0;
		await batch.processArray(tidKeys, async (keys) => {
			const tids = [];
			keys.forEach((key) => {
				const tid = key.split(':')[1];
				if (tid) {
					tids.push(tid);
				}
			});
			const exists = await db.exists(tids.map(tid => `topic:${tid}`));
			const bulkDelete = [];
			tids.forEach((tid, index) => {
				if (!exists[index]) {
					bulkDelete.push(`tid:${tid}:recipients`);
				}
			});
			await db.deleteAll(bulkDelete);

			progress.incr(keys.length);
		}, {
			batch: 500,
		});
	},
};
