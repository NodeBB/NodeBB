'use strict';


const db = require('../../database');
const batch = require('../../batch');


module.exports = {
	name: 'Create chat:room:<room_id>uids:online zset',
	timestamp: Date.UTC(2023, 6, 14),
	method: async function () {
		const { progress } = this;

		progress.total = await db.sortedSetCard('chat:rooms');

		await batch.processSortedSet('chat:rooms', async (roomIds) => {
			progress.incr(roomIds.length);
			const arrayOfUids = await db.getSortedSetsMembersWithScores(roomIds.map(roomId => `chat:room:${roomId}:uids`));

			const bulkAdd = [];
			arrayOfUids.forEach((uids, idx) => {
				const roomId = roomIds[idx];
				uids.forEach((uid) => {
					bulkAdd.push([`chat:room:${roomId}:uids:online`, uid.score, uid.value]);
				});
			});
			await db.sortedSetAddBulk(bulkAdd);
		}, {
			batch: 100,
		});
	},
};
