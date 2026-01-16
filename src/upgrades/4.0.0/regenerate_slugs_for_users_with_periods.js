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
			await Promise.all(data.map(async ({ uid, username, userslug }) => {
				if (username.includes('.') && userslug !== slugify(username)) {
					const value = slugify(username);
					await Promise.all([
						db.sortedSetRemove('userslug:uid', userslug),
						user.setUserField(uid, 'userslug', value),
						db.sortedSetAdd('userslug:uid', uid, value),
					]);
				}
			}));

			progress.incr(uids.length);
		}, {
			batch: 500,
			progress: progress,
		});
	},
};
