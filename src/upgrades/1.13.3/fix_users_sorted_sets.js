'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Fix user sorted sets',
	timestamp: Date.UTC(2020, 4, 2),
	method: async function () {
		const { progress } = this;
		const nextUid = await db.getObjectField('global', 'nextUid');
		const allUids = [];
		for (let i = 1; i <= nextUid; i++) {
			allUids.push(i);
		}

		progress.total = nextUid;
		let totalUserCount = 0;

		await db.delete('user:null');
		await db.sortedSetsRemove([
			'users:joindate',
			'users:reputation',
			'users:postcount',
			'users:flags',
		], 'null');

		await batch.processArray(allUids, async (uids) => {
			progress.incr(uids.length);
			const userData = await db.getObjects(uids.map(id => `user:${id}`));

			await Promise.all(userData.map(async (userData, index) => {
				if (!userData || !userData.uid) {
					await db.sortedSetsRemove([
						'users:joindate',
						'users:reputation',
						'users:postcount',
						'users:flags',
					], uids[index]);
					if (userData && !userData.uid) {
						await db.delete(`user:${uids[index]}`);
					}
					return;
				}
				totalUserCount += 1;
				await db.sortedSetAddBulk([
					['users:joindate', userData.joindate || Date.now(), uids[index]],
					['users:reputation', userData.reputation || 0, uids[index]],
					['users:postcount', userData.postcount || 0, uids[index]],
				]);
				if (userData.hasOwnProperty('flags') && parseInt(userData.flags, 10) > 0) {
					await db.sortedSetAdd('users:flags', userData.flags, uids[index]);
				}
			}));
		}, {
			progress: progress,
			batch: 500,
		});

		await db.setObjectField('global', 'userCount', totalUserCount);
	},
};
