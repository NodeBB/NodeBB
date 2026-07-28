'use strict';

const install = require('../../install');

module.exports = {
	name: 'Backfill trust_proxy for upgraded installs',
	timestamp: Date.UTC(2026, 6, 28),
	method: async function () {
		let configJSON;
		try {
			configJSON = require('../../../config.json') || {};
		} catch (err) {
			configJSON = {};
		}

		if (!Object.hasOwn(configJSON, 'trust_proxy')) {
			await install.save({ trust_proxy: true });
		}
	},
};