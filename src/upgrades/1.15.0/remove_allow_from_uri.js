'use strict';

const db = require('../../database');

module.exports = {
	name: 'Remove allow from uri setting',
	timestamp: Date.UTC(2020, 8, 6),
	method: async function () {
		const meta = require('../../meta');
		if (meta.config['allow-from-uri']) {
			await db.setObjectField('config', 'csp-frame-ancestors', meta.config['allow-from-uri']);
		}
		await db.deleteObjectField('config', 'allow-from-uri');
	},
};
