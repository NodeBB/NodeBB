'use strict';


const db = require('../../database');
const batch = require('../../batch');


module.exports = {
	name: 'Fix user email sorted sets',
	timestamp: Date.UTC(2023, 1, 4),
	method: async function () {
		const { progress } = this;
		const bulkRemove = [];
		await batch.processSortedSet('email:uid', async (data) => {
			progress.incr(data.length);
			const usersData = await db.getObjects(data.map(d => `user:${d.score}`));
			data.forEach((emailData, index) => {
				const { score: uid, value: email } = emailData;
				const userData = usersData[index];
				// user no longer exists or doesn't have email set in user hash
				// remove the email/uid pair from email:uid, email:sorted
				if (!userData || !userData.email) {
					bulkRemove.push(['email:uid', email]);
					bulkRemove.push(['email:sorted', `${email.toLowerCase()}:${uid}`]);
					return;
				}

				// user has email but doesn't match whats stored in user hash, gh#11259
				if (userData.email && userData.email.toLowerCase() !== email.toLowerCase()) {
					bulkRemove.push(['email:uid', email]);
					bulkRemove.push(['email:sorted', `${email.toLowerCase()}:${uid}`]);
				}
			});
		}, {
			batch: 500,
			withScores: true,
			progress: progress,
		});

		await batch.processArray(bulkRemove, async (bulk) => {
			await db.sortedSetRemoveBulk(bulk);
		}, {
			batch: 500,
		});
	},
};
