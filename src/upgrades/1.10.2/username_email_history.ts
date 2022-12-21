'use strict';

const db = require('../../database');

const batch = require('../../batch');
const user = require('../../user');

module.exports = {
	name: 'Record first entry in username/email history',
	timestamp: Date.UTC(2018, 7, 28),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('users:joindate', async (uids) => {
			async function updateHistory(uid, set, fieldName) {
				const count = await db.sortedSetCard(set);
				if (count <= 0) {
					// User has not changed their username/email before, record original username
					const userData = await user.getUserFields(uid, [fieldName, 'joindate']);
					if (userData && userData.joindate && userData[fieldName]) {
						await db.sortedSetAdd(set, userData.joindate, [userData[fieldName], userData.joindate].join(':'));
					}
				}
			}

			await Promise.all(uids.map(async (uid) => {
				await Promise.all([
					updateHistory(uid, `user:${uid}:usernames`, 'username'),
					updateHistory(uid, `user:${uid}:emails`, 'email'),
				]);
				progress.incr();
			}));
		}, {
			progress: this.progress,
		});
	},
};
