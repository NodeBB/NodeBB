// REMOVE THIS PRIOR TO 4.0 ALPHA

'use strict';

const db = require('../../database');
const activitypub = require('../../activitypub');

module.exports = {
	name: 'Re-assert all existing actors to save URL into hash',
	timestamp: Date.UTC(2024, 3, 4),
	method: async () => {
		const batch = require('../../batch');
		const { progress } = this;
		const interval = 5000;

		await batch.processSortedSet('usersRemote:lastCrawled', async (ids) => {
			const exists = await Promise.all(ids.map(async id => await db.isObjectField(`userRemote:${id}`, 'url')));
			ids = ids.filter((id, idx) => exists[idx]);

			try {
				await activitypub.actors.assert(ids, { update: true });
			} catch (e) {
				// noop
			}
		}, { progress, interval });
	},
};
