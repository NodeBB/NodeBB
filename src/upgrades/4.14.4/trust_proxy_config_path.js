'use strict';

const fs = require('fs');
const path = require('path');
const nconf = require('nconf');

module.exports = {
	name: 'Backfill trust_proxy into the config file specified via --config',
	timestamp: Date.UTC(2026, 6, 29),
	method: async function () {
		// 4.14.3/trust_proxy.js wrote to a hardcoded <app>/config.json, missing installs
		// started with `--config`/CONFIG pointing elsewhere (e.g. Docker mounts it at
		// /opt/config), which left those forums with broken sessions/logins behind a
		// reverse proxy. Re-run the backfill against the config file actually in use.
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
