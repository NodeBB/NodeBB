'use strict';

const crypto = require('crypto');

const db = require('../../database');
const batch = require('../../batch');

const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');

module.exports = {
	name: 'Rename object and sorted sets used in post uploads',
	timestamp: Date.UTC(2022, 1, 10),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('posts:pid', async (pids) => {
			let keys = pids.map(pid => `post:${pid}:uploads`);
			const exists = await db.exists(keys);
			keys = keys.filter((key, idx) => exists[idx]);

			progress.incr(pids.length - keys.length);

			await Promise.all(keys.map(async (key) => {
				// Rename the paths within
				let uploads = await db.getSortedSetRangeWithScores(key, 0, -1);

				// Don't process those that have already the right format
				uploads = uploads.filter(upload => !upload.value.startsWith('files/'));

				// Rename the zset members
				await db.sortedSetRemove(key, uploads.map(upload => upload.value));
				await db.sortedSetAdd(
					key,
					uploads.map(upload => upload.score),
					uploads.map(upload => `files/${upload.value}`)
				);

				// Rename the object and pids zsets
				const hashes = uploads.map(upload => md5(upload.value));
				const newHashes = uploads.map(upload => md5(`files/${upload.value}`));
				const promises = hashes.map((hash, idx) => db.rename(`upload:${hash}`, `upload:${newHashes[idx]}`));
				promises.concat(hashes.map((hash, idx) => db.rename(`upload:${hash}:pids`, `upload:${newHashes[idx]}:pids`)));

				await Promise.all(promises);
				progress.incr();
			}));
		}, {
			batch: 100,
			progress: progress,
		});
	},
};
