/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Update chat messages to add roomId field',
	timestamp: Date.UTC(2023, 6, 2),
	method: async function () {
		const { progress } = this;

		const nextChatRoomId = await db.getObjectField('global', 'nextChatRoomId');
		const allRoomIds = [];
		for (let i = 1; i <= nextChatRoomId; i++) {
			allRoomIds.push(i);
		}
		progress.total = 0;

		// calculate user count and set progress.total
		await batch.processArray(allRoomIds, async (roomIds) => {
			await Promise.all(roomIds.map(async (roomId) => {
				const userCount = await db.sortedSetCard(`chat:room:${roomId}:uids`);
				await db.setObjectField(`chat:room:${roomId}`, 'userCount', userCount);
				progress.total += userCount;
			}));
		}, {
			batch: 500,
		});

		await batch.processArray(allRoomIds, async (roomIds) => {
			const arrayOfRoomData = await db.getObjects(roomIds.map(roomId => `chat:room:${roomId}`));
			for (const roomData of arrayOfRoomData) {
				if (roomData) {
					const midsSeen = {};
					const { roomId } = roomData;
					await batch.processSortedSet(`chat:room:${roomId}:uids`, async (uids) => {
						for (const uid of uids) {
							await batch.processSortedSet(`uid:${uid}:chat:room:${roomId}:mids`, async (mids) => {
								const uniqMids = mids.filter(mid => !midsSeen.hasOwnProperty(mid));
								if (!uniqMids.length) {
									return;
								}

								let messageData = await db.getObjects(uniqMids.map(mid => `message:${mid}`));
								messageData.forEach((m, idx) => {
									if (m) {
										m.mid = parseInt(uniqMids[idx], 10);
									}
								});
								messageData = messageData.filter(Boolean);

								const bulkSet = messageData.map(
									msg => [`message:${msg.mid}`, { roomId: roomId }]
								);

								await db.setObjectBulk(bulkSet);
								await db.sortedSetAdd(
									`chat:room:${roomId}:mids`,
									messageData.map(m => m.timestamp),
									messageData.map(m => m.mid),
								);
								uniqMids.forEach((mid) => {
									midsSeen[mid] = 1;
								});
							}, {
								batch: 500,
							});
							// eslint-disable-next-line no-await-in-loop
							await db.deleteAll(`uid:${uid}:chat:room:${roomId}:mids`);
						}
						progress.incr(uids.length);
					}, {
						batch: 500,
					});
				}
			}
		}, {
			batch: 500,
		});
	},
};
