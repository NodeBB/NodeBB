'use strict';

const _ = require('lodash');
const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Normalize topic thumbnails and post uploads to same format',
	timestamp: Date.UTC(2021, 1, 7),
	method: async function () {
		const { progress } = this;

		const [topicCount, postCount] = await db.sortedSetsCard(['topics:tid', 'posts:pid']);
		progress.total = topicCount + postCount;

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
	},
};
