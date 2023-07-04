'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Store list of chat rooms',
	timestamp: Date.UTC(2023, 6, 3),
	method: async function () {
		const { progress } = this;
		const lastRoomId = await db.getObjectField('global', 'nextChatRoomId');
		const allKeys = [];
		for (let x = 1; x <= lastRoomId; x++) {
			allKeys.push(`chat:room:${x}`);
		}
		await batch.processArray(allKeys, async (keys) => {
			progress.incr(keys.length);
			const exists = await db.exists(keys);
			keys = keys.filter((_, idx) => exists[idx]);
			await db.sortedSetAdd('chat:rooms', keys.map(Date.now), keys.map(key => key.slice(10)));
		}, {
			batch: 500,
		});
	},
};
