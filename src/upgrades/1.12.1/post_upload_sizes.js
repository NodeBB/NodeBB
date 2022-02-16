'use strict';

const batch = require('../../batch');
const posts = require('../../posts');
const db = require('../../database');

module.exports = {
	name: 'Calculate image sizes of all uploaded images',
	timestamp: Date.UTC(2019, 2, 16),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('posts:pid', async (pids) => {
			const keys = pids.map(p => `post:${p}:uploads`);
			const uploads = await db.getSortedSetRange(keys, 0, -1);
			await posts.uploads.saveSize(uploads);
			progress.incr(pids.length);
		}, {
			batch: 100,
			progress: progress,
		});
	},
};
