'use strict';

const db = require('../../database');

const batch = require('../../batch');
const user = require('../../user');

module.exports = {
	name: 'Record first entry in username/email history',
	timestamp: Date.UTC(2018, 7, 28),
	method: async function () {
		const { progress } = this;

		progress.total = await db.sortedSetCard('users:joindate');

		await batch.processSortedSet('users:joindate', async (uids) => {
			const [usernameHistory, emailHistory, userData] = await Promise.all([
				db.sortedSetsCard(uids.map(uid => `user:${uid}:usernames`)),
				db.sortedSetsCard(uids.map(uid => `user:${uid}:emails`)),
				user.getUsersFields(uids, ['uid', 'username', 'email', 'joindate']),
			]);

			const bulkAdd = [];
			userData.forEach((data, index) => {
				const thisUsernameHistory = usernameHistory[index];
				const thisEmailHistory = emailHistory[index];
				if (thisUsernameHistory <= 0 && data && data.joindate && data.username) {
					bulkAdd.push([
						`user:${data.uid}:usernames`, data.joindate, [data.username, data.joindate].join(':'),
					]);
				}
				if (thisEmailHistory <= 0 && data && data.joindate && data.email) {
					bulkAdd.push([
						`user:${data.uid}:emails`, data.joindate, [data.email, data.joindate].join(':'),
					]);
				}
			});
			await db.sortedSetAddBulk(bulkAdd);
			progress.incr(uids.length);
		}, {
			batch: 500,
		});
	},
};
