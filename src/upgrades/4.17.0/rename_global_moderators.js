'use strict';

const winston = require('winston');

module.exports = {
	name: 'Rename Global Moderators group to global-moderators',
	timestamp: Date.UTC(2026, 8, 23),
	method: async function () {
		const groups = require('../../groups');
		const exists = await groups.exists('Global Moderators');
		if (!exists) {
			return;
		}
		winston.info('[upgrade] Renaming "Global Moderators" group to "global-moderators"');
		await groups.renameGroup('Global Moderators', 'global-moderators');
	},
};
