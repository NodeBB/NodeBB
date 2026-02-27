'use strict';

const db = require('../../database');
const batch = require('../../batch');
const utils = require('../../utils');

module.exports = {
	name: 'Move ap pids from posts:pid to postsRemote:pid',
	timestamp: Date.UTC(2026, 1, 24),
	method: async function () {
		const { progress } = this;
		progress.total = await db.sortedSetCard('posts:pid');
		const removePosts = [];
		await batch.processSortedSet('posts:pid', async (postData) => {
			const apPosts = postData.filter(post => !utils.isNumber(post.value));
			removePosts.push(...apPosts.map(post => post.value));
			await db.sortedSetAdd(
				'postsRemote:pid',
				apPosts.map(p => p.score),
				apPosts.map(p => p.value)
			);
			progress.incr(postData.length);
		}, {
			batch: 500,
			withScores: true,
		});
		progress.current = 0;
		progress.counter = 0;
		progress.total = removePosts.length;
		await batch.processArray(removePosts, async (pids) => {
			await db.sortedSetRemove(['posts:pid', 'posts:votes'], pids);
			progress.incr(pids.length);
		}, {
			batch: 500,
		});

		const postCount = await db.sortedSetCard('posts:pid');
		await db.setObjectField('global', 'postCount', postCount);
	},
};
