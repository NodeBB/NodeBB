'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Remove extraneous upvote and tids_read data for remote users',
	timestamp: Date.UTC(2025, 11, 11),
	method: async function () {
		const { progress } = this;
		await batch.processSortedSet('usersRemote:lastCrawled', async (uids) => {
			const readKeys = uids.map(uid => `uid:${uid}:tids_read`);
			const voteKeys = uids.map(uid => `uid:${uid}:upvote`);

			const combined = readKeys.concat(voteKeys);

			await db.deleteAll(combined);
			progress.incr(uids.length);
		}, {
			batch: 500,
			progress,
		});
	},
};
