'use strict';

const fs = require('fs');
const path = require('path');
const nconf = require('nconf');

module.exports = {
	name: 'Backfill trust_proxy into the config file specified via --config',
	timestamp: Date.UTC(2026, 6, 29),
	method: async function () {
		const pathToConfig = path.resolve(__dirname, '../../../', nconf.get('config') || 'config.json');

		let configJSON;
		try {
			configJSON = JSON.parse(await fs.promises.readFile(pathToConfig, 'utf8')) || {};
		} catch (err) {
			configJSON = {};
		}

		if (!Object.hasOwn(configJSON, 'trust_proxy')) {
			await fs.promises.writeFile(pathToConfig, JSON.stringify({
				...configJSON,
				trust_proxy: true,
			}, null, 4));
		}
	},
};
