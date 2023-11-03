/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');
const user = require('../../user');
const batch = require('../../batch');

module.exports = {
	name: 'Add tracking category state',
	timestamp: Date.UTC(2023, 10, 3),
	method: async function () {
		const { progress } = this;

		const current = await db.getObjectField('config', 'categoryWatchState');
		if (current === 'watching') {
			await db.setObjectField('config', 'categoryWatchState', 'tracking');
		}

		await batch.processSortedSet(`users:joindate`, async (uids) => {
			const userSettings = await user.getMultipleUserSettings(uids);
			const change = userSettings.filter(s => s && s.categoryWatchState === 'watching');
			await db.setObjectBulk(
				change.map(s => [`user:${s.uid}:settings`, { categoryWatchState: 'tracking' }])
			);
			progress.incr(uids.length);
		}, {
			batch: 500,
			progress,
		});
	},
};
