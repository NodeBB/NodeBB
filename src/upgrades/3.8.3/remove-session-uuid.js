'use strict';


const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Remove uid:<uid>:sessionUUID:sessionId object',
	timestamp: Date.UTC(2024, 5, 26),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('users:joindate', async (uids) => {
			progress.incr(uids.length);
			await db.deleteAll(uids.map(uid => `uid:${uid}:sessionUUID:sessionId`));
		}, {
			batch: 500,
			progress: progress,
		});
	},
};
