'use strict';

const db = require('../../database');
const batch = require('../../batch');
const user = require('../../user');
const slugify = require('../../slugify');

module.exports = {
	name: 'Regenerate user slugs for users whose usernames contained periods',
	timestamp: Date.UTC(2024, 10, 28),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('users:joindate', async (uids) => {
			const data = await user.getUsersFields(uids, ['username', 'userslug']);
			const bulkSet = [];
			const bulkAdd = [];
			const bulkRemove = [];
			data.forEach(({ uid, username, userslug }) => {
				if (username.includes('.') && userslug !== slugify(username)) {
					const value = slugify(username);
					bulkSet.push([`user:${uid}`, { userslug: value }]);
					bulkAdd.push([`userslug:uid`, uid, value]);
					bulkRemove.push(userslug);
				}
			});
			await Promise.all([
				db.sortedSetRemove('userslug:uid', bulkRemove),
				db.sortedSetAddBulk(bulkAdd),
				db.setObjectBulk(bulkSet),
			]);
			progress.incr(uids.length);
		}, {
			batch: 500,
			progress: progress,
		});
	},
};
