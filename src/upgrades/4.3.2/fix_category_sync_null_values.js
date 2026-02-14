'use strict';

const db = require('../../database');

module.exports = {
	name: 'Fix null values in category synchronization list',
	timestamp: Date.UTC(2025, 4, 8),
	method: async () => {
		const cids = await db.getSortedSetMembers('categories:cid');
		await db.sortedSetsRemove(cids.map(cid => `followRequests:cid.${cid}`), 'null');
	},
};
