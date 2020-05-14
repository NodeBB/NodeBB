'use strict';

const nconf = require('nconf');
const db = require('../../database');

module.exports = {
	name: 'Change {_key,value} index to use collation and numericOrdering',
	timestamp: Date.UTC(2020, 4, 14),
	method: async function (callback) {
		const isMongo = nconf.get('database') === 'mongo';
		if (!isMongo) {
			return callback();
		}
		try {
			await db.client.collection('objects').dropIndex({ _key: 1, value: -1 });
		} catch (err) {
			console.log(err.stack);
		}

		await db.client.collection('objects').createIndex({ _key: 1, value: -1 }, {
			background: true,
			unique: true,
			sparse: true,
			collation: { locale: 'en_US', numericOrdering: true },
		});

		callback();
	},
};
