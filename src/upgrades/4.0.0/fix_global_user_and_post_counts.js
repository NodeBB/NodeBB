'use strict';

const db = require('../../database');
const meta = require('../../meta');

module.exports = {
	name: 'Fix global counts for users and posts due to faulty AP logic',
	timestamp: Date.UTC(2024, 5, 25),
	method: async () => {
		if (!meta.config.activitypubEnabled) {
			return;
		}

		const counts = await db.sortedSetsCard(['users:joindate', 'posts:pid', 'topics:tid']);
		await db.setObject('global', {
			userCount: counts[0],
			postCount: counts[1],
			topicCount: counts[2],
		});
	},
};
