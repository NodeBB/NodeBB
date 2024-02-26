'use strict';

// const db = require('../../database');

module.exports = {
	name: 'Assigning default privileges to "World" pseudo-category',
	timestamp: Date.UTC(2024, 1, 22),
	method: async () => {
		const install = require('../../install');
		await install.giveWorldPrivileges();
	},
};
