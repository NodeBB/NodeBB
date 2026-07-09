'use strict';

const db = require('../../database');
const batch = require('../../batch');
const user = require('../../user');
const tx = require('../../translator');
const utils = require('../../utils');

module.exports = {
	name: 'Fix system chat messages so they have tx string and a type field',
	timestamp: Date.UTC(2026, 5, 14),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet(`messages:mid`, async (mids) => {
			const messageData = await db.getObjects(mids.map(mid => `message:${mid}`));
			const bulkSet = [];
			for (const m of messageData) {
				if (m && m.content && String(m.system) === '1') {
					// eslint-disable-next-line no-await-in-loop
					const displayname = await user.getNotificationDisplayname(m.fromuid);
					const timestampISO = utils.toISOString(m.timestamp || Date.now());
					if (m.content.startsWith('room-rename,')) {
						const type = 'room-rename';
						// fix old room-rename message which hacked roomName into content
						// ie "room-rename, NEW ROOM NAME"
						const parts = m.content.split(',');
						const newRoomName = parts[1] ? parts[1].trim() : '';
						const content = tx.compile(
							`modules:chat.system.room-rename`,
							displayname,
							timestampISO,
							tx.escape(newRoomName)
						);
						bulkSet.push([`message:${m.mid}`, { type, content }]);
					} else if (m.content === 'user-join' || m.content === 'user-leave') {
						const type = m.content;
						const content = tx.compile(
							`modules:chat.system.${type}`,
							displayname,
							timestampISO
						);
						bulkSet.push([`message:${m.mid}`, { type, content }]);
					}
				}
			}

			await db.setObjectBulk(bulkSet);
			progress.incr(bulkSet.length);
		}, {
			batch: 500,
			progress,
		});
	},
};
