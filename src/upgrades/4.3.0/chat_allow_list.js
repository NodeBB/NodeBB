'use strict';

const db = require('../../database');
const batch = require('../../batch');


module.exports = {
	name: 'Set user chat allow list to the users following if they turned on restrict chat',
	timestamp: Date.UTC(2025, 3, 25),
	method: async function () {
		const { progress } = this;

		progress.total = await db.sortedSetCard('users:joindate');

		await batch.processSortedSet('users:joindate', async (uids) => {
			const keys = uids.map(uid => `user:${uid}:settings`);
			const [userSettings, followingUids] = await Promise.all([
				db.getObjects(keys),
				db.getSortedSetsMembers(uids.map(uid => `following:${uid}`)),
			]);

			const bulkSet = [];

			userSettings.forEach((settings, idx) => {
				if (settings) {
					const uid = uids[idx];
					const followingUidsOfThisUser = followingUids[idx] || [];

					if (parseInt(settings.restrictChat, 10) === 1 && followingUidsOfThisUser.length > 0) {
						bulkSet.push([
							`user:${uid}:settings`, { chatAllowList: JSON.stringify(followingUidsOfThisUser) },
						]);
					}
				}
			});

			await db.setObjectBulk(bulkSet);

			progress.incr(uids.length);
		}, {
			batch: 500,
		});
	},
};
