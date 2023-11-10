/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');

module.exports = {
	name: 'Convert rewards:list to a sorted set',
	timestamp: Date.UTC(2023, 10, 10),
	method: async function () {
		const rewards = await db.getSetMembers('rewards:list');
		if (rewards.length) {
			rewards.sort((a, b) => a - b);
			await db.delete('rewards:list');
			await db.sortedSetAdd(
				'rewards:list',
				rewards.map((id, index) => index),
				rewards.map(id => id)
			);
		}
	},
};
