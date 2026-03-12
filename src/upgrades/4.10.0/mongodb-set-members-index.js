'use strict';


const db = module.parent.require('./database');

module.exports = {
	name: 'Add a partial index on set members',
	timestamp: Date.UTC(2026, 2, 11),
	method: async function () {
		const nconf = require.main.require('nconf');
		const isMongo = nconf.get('database') === 'mongo';
		if (!isMongo) {
			return;
		}

		await db.client.collection('objects').createIndex(
			{ members: 1, _key: 1 },
			{  background: true, partialFilterExpression: { members: { $exists: true } } },
		);
	},
};

