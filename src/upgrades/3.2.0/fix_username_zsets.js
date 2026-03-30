'use strict';


const db = require('../../database');
const batch = require('../../batch');


module.exports = {
	name: 'Fix username zsets',
	timestamp: Date.UTC(2023, 5, 5),
	method: async function () {
		const { progress } = this;

		const [userNameUid, usernameSorted, usersJoindate] = await db.sortedSetsCard([
			'username:uid', 'username:sorted', 'users:joindate',
		]);
		progress.total = userNameUid + usernameSorted + usersJoindate;

		await batch.processSortedSet('username:uid', async (usernames) => {
			await db.sortedSetRemove('username:uid', usernames);
			progress.incr(usernames.length);
		}, {
			batch: 500,
			alwaysStartAt: 0,
		});

		await batch.processSortedSet('username:sorted', async (usernames) => {
			await db.sortedSetRemove('username:sorted', usernames);
			progress.incr(usernames.length);
		}, {
			batch: 500,
			alwaysStartAt: 0,
		});

		await batch.processSortedSet('users:joindate', async (uids) => {
			const usersData = await db.getObjects(uids.map(uid => `user:${uid}`));
			const bulkAdd = [];
			usersData.forEach((userData) => {
				if (userData && userData.username) {
					bulkAdd.push(['username:uid', userData.uid, userData.username]);
					bulkAdd.push(['username:sorted', 0, `${String(userData.username).toLowerCase()}:${userData.uid}`]);
				}
			});
			await db.sortedSetAddBulk(bulkAdd);
			progress.incr(uids.length);
		}, {
			batch: 500,
		});
	},
};
