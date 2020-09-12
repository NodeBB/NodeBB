'use strict';

const db = require('../../database');

const batch = require('../../batch');
const user = require('../../user');

module.exports = {
	name: 'Create fullname search set',
	timestamp: Date.UTC(2020, 8, 11),
	method: async function () {
		const progress = this.progress;

		await batch.processSortedSet('users:joindate', async function (uids) {
			progress.incr(uids.length);
			const userData = await user.getUsersFields(uids, ['uid', 'fullname']);
			const bulkAdd = userData
				.filter(u => u.uid && u.fullname)
				.map(u => ['fullname:sorted', 0, u.fullname.toLowerCase() + ':' + u.uid]);
			await db.sortedSetAddBulk(bulkAdd);
		}, {
			batch: 500,
			progress: this.progress,
		});
	},
};
