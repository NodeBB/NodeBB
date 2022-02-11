'use strict';

const crypto = require('crypto');

const db = require('../../database');
const batch = require('../../batch');

const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');

module.exports = {
	name: 'Fix paths in user uploads sorted sets',
	timestamp: Date.UTC(2022, 1, 10),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('users:joindate', async (uids) => {
			let keys = uids.map(uid => `uid:${uid}:uploads`);
			const exists = await db.exists(keys);
			keys = keys.filter((key, idx) => exists[idx]);

			progress.incr(uids.length - keys.length);

			await Promise.all(keys.map(async (key, idx) => {
				// Rename the paths within
				let uploads = await db.getSortedSetRangeWithScores(key, 0, -1);

				// Don't process those that have already the right format
				uploads = uploads.filter(upload => upload.value.startsWith('/files/'));

				await db.sortedSetRemove(key, uploads.map(upload => upload.value));
				await db.sortedSetAdd(
					key,
					uploads.map(upload => upload.score),
					uploads.map(upload => upload.value.slice(1))
				);

				// Add uid to the upload's hash object
				uploads = await db.getSortedSetMembers(key);
				await db.setObjectBulk(uploads.map(relativePath => [`upload:${md5(relativePath)}`, { uid: uids[idx] }]));

				progress.incr();
			}));
		}, {
			batch: 100,
			progress: progress,
		});
	},
};
