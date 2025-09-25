'use strict';

const db = require('../../database');
const posts = require('../../posts');
const batch = require('../../batch');

module.exports = {
	name: 'Refresh post-upload associations',
	timestamp: Date.UTC(2018, 3, 16),
	method: async function () {
		const { progress } = this;
		progress.total = await db.sortedSetCard('posts:pid');
		await batch.processSortedSet('posts:pid', async (pids) => {
			await Promise.all(pids.map(pid => posts.uploads.sync(pid)));
			progress.incr(pids.length);
		}, {
			batch: 500,
		});
	},
};
