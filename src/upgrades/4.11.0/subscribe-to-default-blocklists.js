'use strict';

const db = require('../../database');

module.exports = {
	name: 'Subscribe to IFTAS DNI and AUD denylists',
	timestamp: Date.UTC(2026, 2, 23),
	method: async () => {
		await db.sortedSetAdd('blocklists', [Date.now(), Date.now()], [
			'https://about.iftas.org/wp-content/uploads/2025/10/iftas-dni-latest.csv',
			'https://about.iftas.org/wp-content/uploads/2025/10/iftas-abandoned-unmanaged-latest.csv',
		]);
	},
};
