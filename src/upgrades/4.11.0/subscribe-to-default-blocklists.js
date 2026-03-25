'use strict';

const activitypub = require('../../activitypub');

module.exports = {
	name: 'Subscribe to IFTAS DNI and AUD denylists',
	timestamp: Date.UTC(2026, 2, 23),
	method: async () => {
		await Promise.all([
			activitypub.blocklists.add('https://about.iftas.org/wp-content/uploads/2025/10/iftas-dni-latest.csv'),
			activitypub.blocklists.add('https://about.iftas.org/wp-content/uploads/2025/10/iftas-abandoned-unmanaged-latest.csv'),
		]);
	},
};
