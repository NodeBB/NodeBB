'use strict';

module.exports = {
	name: 'Set default analytics retention to 365 days for existing instances',
	timestamp: Date.UTC(2026, 8, 24),
	method: async function () {
		const meta = require('../../meta');
		const existing = await meta.configs.get('analyticsRetention');
		if (existing !== null && existing !== undefined) {
			return;
		}
		await meta.configs.set('analyticsRetention', 365);
	},
};
