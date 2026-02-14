/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Upgrade bans to hashes',
	timestamp: Date.UTC(2018, 8, 24),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('users:joindate', async (uids) => {
			for (const uid of uids) {
				progress.incr();
				const [bans, reasons, userData] = await Promise.all([
					db.getSortedSetRevRangeWithScores(`uid:${uid}:bans`, 0, -1),
					db.getSortedSetRevRangeWithScores(`banned:${uid}:reasons`, 0, -1),
					db.getObjectFields(`user:${uid}`, ['banned', 'banned:expire', 'joindate', 'lastposttime', 'lastonline']),
				]);

				// has no history, but is banned, create plain object with just uid and timestmap
				if (!bans.length && parseInt(userData.banned, 10)) {
					const banTimestamp = (
						userData.lastonline ||
						userData.lastposttime ||
						userData.joindate ||
						Date.now()
					);
					const banKey = `uid:${uid}:ban:${banTimestamp}`;
					await addBan(uid, banKey, { uid: uid, timestamp: banTimestamp });
				} else if (bans.length) {
					// process ban history
					for (const ban of bans) {
						const reasonData = reasons.find(reasonData => reasonData.score === ban.score);
						const banKey = `uid:${uid}:ban:${ban.score}`;
						const data = {
							uid: uid,
							timestamp: ban.score,
							expire: parseInt(ban.value, 10),
						};
						if (reasonData) {
							data.reason = reasonData.value;
						}
						await addBan(uid, banKey, data);
					}
				}
			}
		}, {
			progress: this.progress,
		});
	},
};

async function addBan(uid, key, data) {
	await db.setObject(key, data);
	await db.sortedSetAdd(`uid:${uid}:bans:timestamp`, data.timestamp, key);
}
