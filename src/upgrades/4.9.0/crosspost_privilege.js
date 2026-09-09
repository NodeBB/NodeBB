'use strict';

const privileges = require('../../privileges');
const db = require('../../database');

module.exports = {
	name: 'Give topic:crosspost privilege to registered-users on all categories',
	timestamp: Date.UTC(2026, 1, 12),
	method: async () => {
		const cids = await db.getSortedSetMembers('categories:cid');
		await Promise.all(cids.map(async (cid) => {
			const can = await privileges.categories.can('topics:create', cid, 'registered-users');
			if (can) {
				await privileges.categories.give(['groups:topics:crosspost'], cid, 'registered-users');
			}
		}));
	},
};
