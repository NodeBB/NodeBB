'use strict';

const db = require('../../database');

module.exports = {
	name: 'Relax newbie chat delay default',
	timestamp: Date.UTC(2026, 4, 20),
	method: async function () {
		const current = await db.getObjectField('config', 'newbieChatMessageDelay');
		if (parseInt(current, 10) === 120000) {
			await db.setObjectField('config', 'newbieChatMessageDelay', 3000);
		}
	},
};
