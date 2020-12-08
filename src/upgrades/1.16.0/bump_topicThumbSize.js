'use strict';

const meta = require('../../meta');

module.exports = {
	name: 'Increase maximum topic thumb size default',
	timestamp: Date.UTC(2020, 11, 8),
	method: async () => {
		const current = await meta.configs.get('topicThumbSize');

		if (parseInt(current, 10) === 120) {
			await meta.configs.set('topicThumbSize', 512);
		}
	},
};
