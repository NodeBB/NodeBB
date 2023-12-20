/* eslint-disable no-await-in-loop */

'use strict';

const db = require('../../database');

module.exports = {
	name: 'Rename newbiePostDelayThreshold to newbieReputationThreshold',
	timestamp: Date.UTC(2023, 10, 7),
	method: async function () {
		const current = await db.getObjectField('config', 'newbiePostDelayThreshold');
		await db.setObjectField('config', 'newbieReputationThreshold', current);
		await db.deleteObjectField('config', 'newbiePostDelayThreshold');
	},
};
