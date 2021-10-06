'use strict';


const db = require('../../database');

module.exports = {
	name: 'Upgrading config urls to use assets route',
	timestamp: Date.UTC(2017, 1, 28),
	method: async function () {
		const config = await db.getObject('config');
		if (config) {
			const keys = [
				'brand:favicon',
				'brand:touchicon',
				'og:image',
				'brand:logo:url',
				'defaultAvatar',
				'profile:defaultCovers',
			];

			keys.forEach((key) => {
				const oldValue = config[key];

				if (!oldValue || typeof oldValue !== 'string') {
					return;
				}

				config[key] = oldValue.replace(/(?:\/assets)?\/(images|uploads)\//g, '/assets/$1/');
			});

			await db.setObject('config', config);
		}
	},
};
