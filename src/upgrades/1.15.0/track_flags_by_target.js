'use strict';

const db = require('../../database');

module.exports = {
	name: 'New sorted set for tracking flags by target',
	timestamp: Date.UTC(2020, 6, 15),
	method: async () => {
		const flags = await db.getSortedSetRange('flags:hash', 0, -1);
		await Promise.all(flags.map(async (flag) => {
			flag = flag.split(':').slice(0, 2);
			await db.sortedSetIncrBy('flags:byTarget', 1, flag.join(':'));
		}));
	},
};
