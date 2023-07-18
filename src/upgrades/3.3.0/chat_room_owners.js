'use strict';


const db = require('../../database');
const batch = require('../../batch');


module.exports = {
	name: 'Create chat:room:<room_id>:owners zset',
	timestamp: Date.UTC(2023, 6, 17),
	method: async function () {
		const { progress } = this;

		progress.total = await db.sortedSetCard('chat:rooms');

		await batch.processSortedSet('chat:rooms', async (roomIds) => {
			progress.incr(roomIds.length);
			const roomData = await db.getObjects(
				roomIds.map(id => `chat:room:${id}`)
			);

			const bulkAdd = [];
			roomData.forEach((room) => {
				if (room && room.roomId && room.owner && room.timestamp) {
					bulkAdd.push([`chat:room:${room.roomId}:owners`, room.timestamp, room.owner]);
				}
			});

			await db.sortedSetAddBulk(bulkAdd);
		}, {
			batch: 500,
		});
	},
};
