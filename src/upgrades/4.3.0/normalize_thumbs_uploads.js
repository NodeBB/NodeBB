'use strict';

const db = require('../../database');
const batch = require('../../batch');
const crypto = require('crypto');


module.exports = {
	name: 'Normalize topic thumbnails, post & user uploads to same format',
	timestamp: Date.UTC(2025, 3, 4),
	method: async function () {
		const { progress } = this;

		const [topicCount, postCount, userCount] = await db.sortedSetsCard(['topics:tid', 'posts:pid', 'users:joindate']);
		progress.total = topicCount + postCount + userCount;

		function normalizePath(path) {
			if (path.startsWith('http')) {
				return path;
			}
			path = path.replace(/\\/g, '/');
			if (!path.startsWith('/')) {
				path = `/${path}`;
			}
			return path;
		}

		const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');

		await batch.processSortedSet('topics:tid', async (tids) => {
			const keys = tids.map(tid => `topic:${tid}:thumbs`);

			const topicThumbsData = await db.getSortedSetsMembersWithScores(keys);
			const bulkAdd = [];
			const bulkRemove = [];

			topicThumbsData.forEach((topicThumbs, idx) => {
				const tid = tids[idx];
				if (Array.isArray(topicThumbs)) {
					topicThumbs.forEach((thumb) => {
						const normalizedPath = normalizePath(thumb.value);
						if (normalizedPath !== thumb.value) {
							bulkAdd.push([`topic:${tid}:thumbs`, thumb.score, normalizedPath]);
							bulkRemove.push([`topic:${tid}:thumbs`, thumb.value]);
						}
					});
				}
			});

			await db.sortedSetRemoveBulk(bulkRemove);
			await db.sortedSetAddBulk(bulkAdd);

			progress.incr(tids.length);
		}, {
			batch: 500,
		});

		await batch.processSortedSet('posts:pid', async (pids) => {
			const keys = pids.map(pid => `post:${pid}:uploads`);

			const postUploadData = await db.getSortedSetsMembersWithScores(keys);
			const bulkAdd = [];
			const bulkRemove = [];

			postUploadData.forEach((postUploads, idx) => {
				const pid = pids[idx];
				if (Array.isArray(postUploads)) {
					postUploads.forEach((postUpload) => {
						const normalizedPath = normalizePath(postUpload.value);
						if (normalizedPath !== postUpload.value) {
							bulkAdd.push([`post:${pid}:uploads`, postUpload.score, normalizedPath]);
							bulkAdd.push([`upload:${md5(normalizedPath)}:pids`, postUpload.score, pid]);
							bulkRemove.push([`post:${pid}:uploads`, postUpload.value]);
							bulkRemove.push([`upload:${md5(postUpload.value)}:pids`, pid]);
						}
					});
				}
			});

			await db.sortedSetRemoveBulk(bulkRemove);
			await db.sortedSetAddBulk(bulkAdd);

			progress.incr(pids.length);
		}, {
			batch: 500,
		});

		await batch.processSortedSet('users:joindate', async (uids) => {
			const keys = uids.map(uid => `uid:${uid}:uploads`);

			const userUploadData = await db.getSortedSetsMembersWithScores(keys);

			await Promise.all(userUploadData.map(async (allUserUploads, idx) => {
				const uid = uids[idx];
				if (Array.isArray(allUserUploads)) {
					await batch.processArray(allUserUploads, async (userUploads) => {
						const bulkAdd = [];
						const bulkRemove = [];
						const promises = [];
						userUploads.forEach((userUpload) => {
							const normalizedPath = normalizePath(userUpload.value);
							if (normalizedPath !== userUpload.value) {
								bulkAdd.push([`uid:${uid}:uploads`, userUpload.score, normalizedPath]);
								promises.push(db.setObjectField(`upload:${md5(normalizedPath)}`, 'uid', uid));

								bulkRemove.push([`uid:${uid}:uploads`, userUpload.value]);
								promises.push(db.delete(`upload:${md5(userUpload.value)}`));
							}
						});
						await Promise.all(promises);
						await db.sortedSetRemoveBulk(bulkRemove);
						await db.sortedSetAddBulk(bulkAdd);
					}, {
						batch: 500,
					});
				}
			}));

			progress.incr(uids.length);
		}, {
			batch: 100,
		});
	},
};
