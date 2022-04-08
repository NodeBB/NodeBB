'use strict';

const path = require('path');
const fs = require('fs').promises;
const db = require('../../database');

module.exports = {
	name: 'Migrate config secret to data store',
	// remember, month is zero-indexed (so January is 0, December is 11)
	timestamp: Date.UTC(2022, 3, 8),
	method: async () => {
		// No need to wrap in try..catch because nconf is loaded prior, and guarantees that it is present and readable
		const configPath = path.resolve(__dirname, '../../../config.json');
		const config = require(configPath);

		// Move secret to db, otherwise do nothing
		if (config.hasOwnProperty('secret') && config.secret.length) {
			db.setObjectField('global', 'secret', config.secret);
		}

		// Rewrite secret-less config back to disk
		delete config.secret;
		await fs.writeFile(configPath, JSON.stringify(config, null, 4));
	},
};
