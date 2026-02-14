/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Upgrade bans to hashes',
	timestamp: Date.UTC(2018, 8, 24),
	method: async function () {
		const { progress } = this;

		progress.total = await db.sortedSetCard('users:joindate');

		await batch.processSortedSet('users:joindate', async (uids) => {
			progress.incr(uids.length);
			const [allUserData, allBans] = await Promise.all([
				db.getObjectsFields(
					uids.map(uid => `user:${uid}`),
					['banned', 'banned:expire', 'joindate', 'lastposttime', 'lastonline'],
				),
				db.getSortedSetsMembersWithScores(
					uids.map(uid => `uid:${uid}:bans`)
				),
			]);

			await Promise.all(uids.map(async (uid, index) => {
				const userData = allUserData[index];
				const bans = allBans[index] || [];

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
					const reasons = await db.getSortedSetRevRangeWithScores(`banned:${uid}:reasons`, 0, -1);
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
			}));
		}, {
			batch: 500,
		});
	},
};

async function addBan(uid, key, data) {
	await Promise.all([
		db.setObject(key, data),
		db.sortedSetAdd(`uid:${uid}:bans:timestamp`, data.timestamp, key),
	]);
}
