'use strict';

const db = require('../../database');
const privileges = require('../../privileges');

module.exports = {
	name: 'Removing file upload privilege if file uploads were disabled (`allowFileUploads`)',
	timestamp: Date.UTC(2020, 4, 21),
	method: async () => {
		const allowFileUploads = parseInt(await db.getObjectField('config', 'allowFileUploads'), 10);
		if (allowFileUploads === 1) {
			await db.deleteObjectField('config', 'allowFileUploads');
			return;
		}

		// Remove `upload:post:file` privilege for all groups
		await privileges.categories.rescind(['groups:upload:post:file'], 0, ['guests', 'registered-users', 'Global Moderators']);

		// Clean up the old option from the config hash
		await db.deleteObjectField('config', 'allowFileUploads');
	},
};
