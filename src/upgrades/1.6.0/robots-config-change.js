'use strict';

const db = require('../../database');

module.exports = {
	name: 'Fix incorrect robots.txt schema',
	timestamp: Date.UTC(2017, 6, 10),
	method: async function () {
		const config = await db.getObject('config');
		if (config) {
			// fix mongo nested data
			if (config.robots && config.robots.txt) {
				await db.setObjectField('config', 'robots:txt', config.robots.txt);
			} else if (typeof config['robots.txt'] === 'string' && config['robots.txt']) {
				await db.setObjectField('config', 'robots:txt', config['robots.txt']);
			}
			await db.deleteObjectField('config', 'robots');
			await db.deleteObjectField('config', 'robots.txt');
		}
	},
};
