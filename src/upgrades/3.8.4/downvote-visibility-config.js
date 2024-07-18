/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');

module.exports = {
	name: 'Add downvote visibility config field',
	timestamp: Date.UTC(2024, 6, 17),
	method: async function () {
		const current = await db.getObjectField('config', 'voteVisibility');
		if (current) {
			await db.setObject('config', {
				upvoteVisibility: current,
				downvoteVisibility: current,
			});
			await db.deleteObjectField('config', 'voteVisibility');
		}
	},
};
