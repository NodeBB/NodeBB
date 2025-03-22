'use strict';

const db = require('../../database');

module.exports = {
	name: 'Add website and location as custom profile fields',
	timestamp: Date.UTC(2024, 10, 25),
	method: async function () {
		const minRepWebsite = parseInt(await db.getObjectField('config', 'min:rep:website'), 10) || 0;

		const website = {
			icon: 'fa-solid fa-globe',
			key: 'website',
			'min:rep': minRepWebsite,
			name: '[[user:website]]',
			'select-options': '',
			type: 'input-link',
		};

		const location = {
			icon: 'fa-solid fa-map-pin',
			key: 'location',
			'min:rep': 0,
			name: '[[user:location]]',
			'select-options': '',
			type: 'input-text',
		};

		await db.sortedSetAdd(
			`user-custom-fields`,
			[0, 1],
			['website', 'location']
		);

		await db.setObjectBulk([
			[`user-custom-field:website`, website],
			[`user-custom-field:location`, location],
		]);

		await db.deleteObjectField('config', 'min:rep:website');
	},
};
