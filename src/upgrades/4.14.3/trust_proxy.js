'use strict';

const fs = require('fs');
const path = require('path');

module.exports = {
	name: 'Backfill trust_proxy for upgraded installs',
	timestamp: Date.UTC(2026, 6, 28),
	method: async function () {
		let configJSON;
		const pathToConfig = '../../../config.json';
		try {
			configJSON = require(pathToConfig) || {};
		} catch (err) {
			configJSON = {};
		}

		if (!Object.hasOwn(configJSON, 'trust_proxy')) {
			await fs.promises.writeFile(path.join(__dirname, pathToConfig), JSON.stringify({
				...configJSON,
				trust_proxy: true,
			}, null, 4));
		}
	},
};