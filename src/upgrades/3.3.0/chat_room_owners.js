'use strict';


const db = require('../../database');
const batch = require('../../batch');


module.exports = {
	name: 'Create chat:room:<room_id>:owners zset',
	timestamp: Date.UTC(2023, 6, 17),
	method: async function () {
		const { progress } = this;

		progress.total = await db.sortedSetCard('chat:rooms');
		const users = await db.getSortedSetRangeWithScores(`users:joindate`, 0, 0);
		const timestamp = users.length ? users[0].score : Date.now();

		await batch.processSortedSet('chat:rooms', async (roomIds) => {
			progress.incr(roomIds.length);
			const roomData = await db.getObjects(
				roomIds.map(id => `chat:room:${id}`)
			);

			const arrayOfUids = await Promise.all(
				roomIds.map(roomId => db.getSortedSetRangeWithScores(`chat:room:${roomId}:uids`, 0, 0))
			);

			const bulkAdd = [];
			roomData.forEach((room, idx) => {
				if (room && room.roomId && room.owner) {
					// if room doesn't have timestamp for some reason use the first user timestamp
					room.timestamp = room.timestamp || (
						arrayOfUids[idx].length ? (arrayOfUids[idx][0].score || timestamp) : timestamp
					);
					bulkAdd.push([`chat:room:${room.roomId}:owners`, room.timestamp, room.owner]);
				}
			});

			await db.sortedSetAddBulk(bulkAdd);
		}, {
			batch: 500,
		});
	},
};
