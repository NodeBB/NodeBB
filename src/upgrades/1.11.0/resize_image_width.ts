'use strict';

const db = require('../../database');

module.exports = {
	name: 'Rename maximumImageWidth to resizeImageWidth',
	timestamp: Date.UTC(2018, 9, 24),
	method: async function () {
		const meta = require('../../meta');
		const value = await meta.configs.get('maximumImageWidth');
		await meta.configs.set('resizeImageWidth', value);
		await db.deleteObjectField('config', 'maximumImageWidth');
	},
};
