// REMOVE THIS PRIOR TO 4.0 ALPHA

'use strict';

// eslint-disable-next-line no-unused-vars
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
			try {
				await activitypub.actors.assert(ids, { update: true });
			} catch (e) {
				// noop
			}
		}, { progress, interval });
	},
};
