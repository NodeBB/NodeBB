'use strict';


const _ = require('lodash');

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
		progress.total = allRoomIds.length;
		await batch.processArray(allRoomIds, async (roomIds) => {
			progress.incr(roomIds.length);
			await Promise.all(roomIds.map(async (roomId) => {
				const [uids, roomData] = await Promise.all([
					db.getSortedSetRange(`chat:room:${roomId}:uids`, 0, -1),
					db.getObject(`chat:room:${roomId}`),
				]);

				if (!uids.length && !roomData) {
					return;
				}
				if (roomData && roomData.owner && !uids.includes(String(roomData.owner))) {
					uids.push(roomData.owner);
				}
				const userKeys = uids.map(uid => `uid:${uid}:chat:room:${roomId}:mids`);
				const mids = await db.getSortedSetsMembers(userKeys);
				const uniqMids = _.uniq(_.flatten(mids));
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
				await db.deleteAll(userKeys);
			}));
		}, {
			batch: 500,
		});
	},
};
