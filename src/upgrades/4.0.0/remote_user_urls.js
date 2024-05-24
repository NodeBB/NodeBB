// REMOVE THIS PRIOR TO 4.0 ALPHA

'use strict';

const db = require('../../database');
const activitypub = require('../../activitypub');

module.exports = {
	name: 'Re-assert all existing actors to save URL into hash',
	timestamp: Date.UTC(2024, 3, 4),
	method: async function () {
		const batch = require('../../batch');
		const { progress } = this;
		const interval = 1500;

		let actorIds = await db.getSortedSetMembers('usersRemote:lastCrawled');
		progress.total = actorIds.length;
		const existing = await db.getObjectValues('remoteUrl:uid');
		const exists = actorIds.map(actorId => existing.includes(actorId));
		actorIds = actorIds.filter((_, idx) => !exists[idx]);

		// Increment ones that were already completed
		progress.incr(progress.total - actorIds.length);

		await batch.processArray(actorIds, async (ids) => {
			try {
				await activitypub.actors.assert(ids, { update: true });
			} catch (e) {
				// noop
			}

			progress.incr(ids.length);
		}, { progress, interval });
	},
};
