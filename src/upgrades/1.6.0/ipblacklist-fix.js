'use strict';

const db = require('../../database');

module.exports = {
	name: 'Changing ip blacklist storage to object',
	timestamp: Date.UTC(2017, 8, 7),
	method: async function () {
		const rules = await db.get('ip-blacklist-rules');
		await db.delete('ip-blacklist-rules');
		await db.setObject('ip-blacklist-rules', { rules: rules });
	},
};
