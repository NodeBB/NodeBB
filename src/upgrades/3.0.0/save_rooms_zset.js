'use strict';

const db = require('../../database');

module.exports = {
	name: 'Store list of chat rooms',
	timestamp: Date.UTC(2022, 8, 30),
	method: async () => {
		const lastRoomId = await db.getObjectField('global', 'nextChatRoomId');
		let keys = [];
		for (let x = 1; x <= lastRoomId; x++) {
			keys.push(`chat:room:${x}`);
		}

		const exists = await db.exists(keys);
		keys = keys.filter((_, idx) => exists[idx]);
		await db.sortedSetAdd('chat:rooms', keys.map(Date.now), keys.map(key => key.slice(10)));
	},
};
