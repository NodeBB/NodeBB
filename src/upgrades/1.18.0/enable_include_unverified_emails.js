'use strict';

const meta = require('../../meta');

module.exports = {
	name: 'Enable setting to include unverified emails for all mailings',
	// remember, month is zero-indexed (so January is 0, December is 11)
	timestamp: Date.UTC(2021, 5, 18),
	method: async () => {
		await meta.configs.set('includeUnverifiedEmails', 1);
	},
};
