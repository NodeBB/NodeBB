'use strict';

const db = require('../../database');
const privileges = require('../../privileges');

module.exports = {
	name: 'Add "schedule" to default privileges of admins and gmods for existing categories',
	timestamp: Date.UTC(2021, 2, 11),
	method: async () => {
		const privilegeToGive = ['groups:topics:schedule'];

		const cids = await db.getSortedSetRevRange('categories:cid', 0, -1);
		for (const cid of cids) {
			/* eslint-disable no-await-in-loop */
			await privileges.categories.give(privilegeToGive, cid, ['administrators', 'Global Moderators']);
		}
	},
};
