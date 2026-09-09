'use strict';

const privileges = require('../../privileges');

module.exports = {
	name: 'Give chat privileges to fediverse group',
	timestamp: Date.UTC(2026, 7, 12),
	method: async function () {
		await privileges.global.give(['groups:chat'], 'fediverse');
	},
};
