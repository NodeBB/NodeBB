'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Store list of chat rooms',
	timestamp: Date.UTC(2023, 6, 3),
	method: async function () {
		const { progress } = this;
		const lastRoomId = await db.getObjectField('global', 'nextChatRoomId');
		const allRoomIds = [];
		for (let x = 1; x <= lastRoomId; x++) {
			allRoomIds.push(x);
		}
		const users = await db.getSortedSetRangeWithScores(`users:joindate`, 0, 0);
		const timestamp = users.length ? users[0].score : Date.now();
		progress.total = allRoomIds.length;

		await batch.processArray(allRoomIds, async (roomIds) => {
			progress.incr(roomIds.length);
			const keys = roomIds.map(id => `chat:room:${id}`);
			const exists = await db.exists(keys);
			roomIds = roomIds.filter((_, idx) => exists[idx]);
			// get timestamp from uids, if no users use the timestamp of first user
			const arrayOfUids = await Promise.all(
				roomIds.map(roomId => db.getSortedSetRangeWithScores(`chat:room:${roomId}:uids`, 0, 0))
			);

			const timestamps = roomIds.map(
				(id, idx) => (arrayOfUids[idx].length ? (arrayOfUids[idx][0].score || timestamp) : timestamp)
			);

			await db.sortedSetAdd('chat:rooms', timestamps, roomIds);
			await db.setObjectBulk(
				roomIds.map((id, idx) => ([`chat:room:${id}`, { timestamp: timestamps[idx] }]))
			);
		}, {
			batch: 500,
		});
	},
};
