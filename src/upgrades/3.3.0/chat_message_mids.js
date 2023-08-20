/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Set mid on message objects and create messages:mid',
	timestamp: Date.UTC(2023, 6, 27),
	method: async function () {
		const { progress } = this;

		const allRoomIds = await db.getSortedSetRange(`chat:rooms`, 0, -1);

		progress.total = allRoomIds.length;

		for (const roomId of allRoomIds) {
			await batch.processSortedSet(`chat:room:${roomId}:mids`, async (mids) => {
				let messageData = await db.getObjects(mids.map(mid => `message:${mid}`));
				messageData.forEach((m, idx) => {
					if (m) {
						m.mid = parseInt(mids[idx], 10);
					}
				});
				messageData = messageData.filter(Boolean);

				const bulkSet = messageData.map(
					msg => [`message:${msg.mid}`, { mid: msg.mid }]
				);

				await db.setObjectBulk(bulkSet);
				await db.sortedSetAdd(
					'messages:mid',
					messageData.map(msg => msg.timestamp),
					messageData.map(msg => msg.mid)
				);
			}, {
				batch: 500,
			});
			progress.incr(1);
		}

		const count = await db.sortedSetCard(`messages:mid`);
		await db.setObjectField('global', 'messageCount', count);
	},
};
