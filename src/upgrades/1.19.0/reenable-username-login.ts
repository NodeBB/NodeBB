'use strict';

const meta = require('../../meta');

module.exports = {
	name: 'Re-enable username login',
	timestamp: Date.UTC(2021, 10, 23),
	method: async () => {
		const setting = await meta.config.allowLoginWith;

		if (setting === 'email') {
			await meta.configs.set('allowLoginWith', 'username-email');
		}
	},
};
