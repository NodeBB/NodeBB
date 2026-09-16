'use strict';

const meta = require('../../meta');

module.exports = {
	name: 'Make tags case-insensitive by default',
	timestamp: Date.UTC(2026, 7, 26),
	method: async () => {
		await meta.configs.set('caseSensitiveTags', 0);
	},
};
