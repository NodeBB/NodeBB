/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');

module.exports = {
	name: 'Set messageCount on chat rooms',
	timestamp: Date.UTC(2023, 6, 27),
	method: async function () {
		const { progress } = this;
		const allRoomIds = await db.getSortedSetRange(`chat:rooms`, 0, -1);
		progress.total = allRoomIds.length;
		for (const roomId of allRoomIds) {
			const count = await db.sortedSetCard(`chat:room:${roomId}:mids`);
			await db.setObject(`chat:room:${roomId}`, { messageCount: count });
			progress.incr(1);
		}
	},
};
