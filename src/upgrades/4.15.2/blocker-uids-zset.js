'use strict';

const db = require('../../database');
const batch = require('../../batch');
const User = require('../../user');

module.exports = {
	name: 'Add uid:<uid>:blocker_uids zset',
	timestamp: Date.UTC(2026, 7, 30),
	method: async function () {
		const { progress } = this;
		await batch.processSortedSet('users:joindate', async (uids) => {
			const blocks = await User.blocks.list(uids);
			const bulkAdd = [];
			const now = Date.now();
			uids.forEach((uid, index) => {
				const blockedUids = blocks[index] || [];
				if (blockedUids.length) {
					blockedUids.forEach((blockedUid) => {
						bulkAdd.push([
							`uid:${blockedUid}:blocker_uids`,
							now,
							uid,
						]);
					});
				}
			});

			await db.sortedSetAddBulk(bulkAdd);
			progress.incr(uids.length);
		}, {
			batch: 500,
			progress,
		});
	},
};
