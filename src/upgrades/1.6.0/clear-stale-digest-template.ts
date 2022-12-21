'use strict';

const crypto = require('crypto');
const meta = require('../../meta');

module.exports = {
	name: 'Clearing stale digest templates that were accidentally saved as custom',
	timestamp: Date.UTC(2017, 8, 6),
	method: async function () {
		const matches = [
			'112e541b40023d6530dd44df4b0d9c5d', // digest @ 75917e25b3b5ad7bed8ed0c36433fb35c9ab33eb
			'110b8805f70395b0282fd10555059e9f', // digest @ 9b02bb8f51f0e47c6e335578f776ffc17bc03537
			'9538e7249edb369b2a25b03f2bd3282b', // digest @ 3314ab4b83138c7ae579ac1f1f463098b8c2d414
		];
		const fieldset = await meta.configs.getFields(['email:custom:digest']);
		const hash = fieldset['email:custom:digest'] ? crypto.createHash('md5').update(fieldset['email:custom:digest']).digest('hex') : null;
		if (matches.includes(hash)) {
			await meta.configs.remove('email:custom:digest');
		}
	},
};
