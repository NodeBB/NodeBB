/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');

module.exports = {
	name: 'Add vote visibility config field',
	timestamp: Date.UTC(2024, 4, 24),
	method: async function () {
		const current = await db.getObjectField('config', 'votesArePublic');
		const isPublic = parseInt(current, 10) === 1;
		await db.setObjectField('config', 'voteVisibility', isPublic ? 'all' : 'privileged');
		await db.deleteObjectField('config', 'votesArePublic');
	},
};
