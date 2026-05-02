'use strict';


const db = module.parent.require('./database');

module.exports = {
	name: 'Change expireAt index to partial index',
	timestamp: Date.UTC(2026, 3, 3),
	method: async function () {
		const nconf = require.main.require('nconf');
		const isMongo = nconf.get('database') === 'mongo';
		if (!isMongo) {
			return;
		}
		await db.client.collection('objects').dropIndex('expireAt_1');
		await db.client.collection('objects').createIndex(
			{ expireAt: 1 },
			{
				expireAfterSeconds: 0,
				background: true,
				partialFilterExpression: { expireAt: { $exists: true } },
			},
		);
	},
};

