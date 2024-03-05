'use strict';

const db = require('../../database');

module.exports = {
	name: 'Allow remote user profiles to be searched',
	// remember, month is zero-indexed (so January is 0, December is 11)
	timestamp: Date.UTC(2024, 2, 1),
	method: async () => {
		const ids = await db.getSortedSetMembers('usersRemote:lastCrawled');
		const data = await db.getObjectsFields(ids.map(id => `userRemote:${id}`), ['username', 'fullname']);

		const queries = data.reduce((memo, profile, idx) => {
			if (profile && profile.username && profile.fullname) {
				memo.zset.push(['ap.preferredUsername:sorted', 0, `${profile.username.toLowerCase()}:${ids[idx]}`]);
				memo.zset.push(['ap.name:sorted', 0, `${profile.fullname.toLowerCase()}:${ids[idx]}`]);
				memo.hash[profile.username.toLowerCase()] = ids[idx];
			}

			return memo;
		}, { zset: [], hash: {} });

		await Promise.all([
			db.sortedSetAddBulk(queries.zset),
			db.setObject('handle:uid', queries.hash),
		]);
	},
};
