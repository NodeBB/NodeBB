'use strict';


const db = require('../../database');
const batch = require('../../batch');


module.exports = {
	name: 'Set mid on message objects and create messages:mid',
	timestamp: Date.UTC(2023, 6, 27),
	method: async function () {
		const { progress } = this;

		progress.total = await db.sortedSetCard(`chat:rooms`);
		await batch.processSortedSet(`chat:rooms`, async (roomIds) => {
			progress.incr(roomIds.length);
			await Promise.all(roomIds.map(async (roomId) => {
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
			}));
		}, {
			batch: 500,
		});
	},
};
