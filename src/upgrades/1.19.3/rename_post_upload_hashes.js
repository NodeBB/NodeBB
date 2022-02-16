/* eslint-disable no-await-in-loop */

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

			progress.incr(pids.length);

			for (const key of keys) {
				// Rename the paths within
				let uploads = await db.getSortedSetRangeWithScores(key, 0, -1);

				// Don't process those that have already the right format
				uploads = uploads.filter(upload => upload && upload.value && !upload.value.startsWith('files/'));

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

				// cant use db.rename since `fix_user_uploads_zset.js` upgrade script already creates
				// `upload:md5(upload.value) hash, trying to rename to existing key results in dupe error
				const oldData = await db.getObjects(hashes.map(hash => `upload:${hash}`));
				const bulkSet = [];
				oldData.forEach((data, idx) => {
					if (data) {
						bulkSet.push([`upload:${newHashes[idx]}`, data]);
					}
				});
				await db.setObjectBulk(bulkSet);
				await db.deleteAll(hashes.map(hash => `upload:${hash}`));

				await Promise.all(hashes.map((hash, idx) => db.rename(`upload:${hash}:pids`, `upload:${newHashes[idx]}:pids`)));
			}
		}, {
			batch: 100,
			progress: progress,
		});
	},
};
