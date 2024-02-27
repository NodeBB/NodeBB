'use strict';

// const db = require('../../database');
const meta = require('../../meta');

module.exports = {
	name: 'Setting up default configs/privileges re: ActivityPub',
	timestamp: Date.UTC(2024, 1, 22),
	method: async () => {
		// Disable ActivityPub (upgraded installs have to opt-in to AP)
		meta.configs.set('activitypubEnabled', 0);

		// Set default privileges for world category
		const install = require('../../install');
		await install.giveWorldPrivileges();
	},
};
