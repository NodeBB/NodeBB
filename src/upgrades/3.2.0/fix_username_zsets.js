'use strict';


const db = require('../../database');
const batch = require('../../batch');


module.exports = {
	name: 'Fix username zsets',
	timestamp: Date.UTC(2023, 5, 5),
	method: async function () {
		const { progress } = this;

		await db.deleteAll(['username:uid', 'username:sorted']);
		await batch.processSortedSet('users:joindate', async (uids) => {
			progress.incr(uids.length);
			const usersData = await db.getObjects(uids.map(uid => `user:${uid}`));
			const bulkAdd = [];
			usersData.forEach((userData) => {
				if (userData && userData.username) {
					bulkAdd.push(['username:uid', userData.uid, userData.username]);
					bulkAdd.push(['username:sorted', 0, `${String(userData.username).toLowerCase()}:${userData.uid}`]);
				}
			});
			await db.sortedSetAddBulk(bulkAdd);
		}, {
			batch: 500,
			progress: progress,
		});
	},
};
