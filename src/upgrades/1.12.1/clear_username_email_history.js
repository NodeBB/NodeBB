'use strict';


const db = require('../../database');
const user = require('../../user');
const batch = require('../../batch');

module.exports = {
	name: 'Delete username email history for deleted users',
	timestamp: Date.UTC(2019, 2, 25),
	method: async function () {
		const { progress } = this;

		progress.total = await db.getObjectField('global', 'nextUid');
		const allUids = [];
		for (let i = 1; i < progress.total; i += 1) {
			allUids.push(i);
		}
		await batch.processArray(allUids, async (uids) => {
			const exists = await user.exists(uids);
			const missingUids = uids.filter((uid, index) => !exists[index]);
			const keysToDelete = [
				...missingUids.map(uid => `user:${uid}:usernames`),
				...missingUids.map(uid => `user:${uid}:emails`),
			];
			await db.deleteAll(keysToDelete);
			progress.incr(uids.length);
		}, {
			batch: 500,
		});
	},
};
