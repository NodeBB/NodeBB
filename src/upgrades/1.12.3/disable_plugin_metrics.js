'use strict';

const db = require('../../database');

module.exports = {
	name: 'Disable plugin metrics for existing installs',
	timestamp: Date.UTC(2019, 4, 21),
	method: async function (callback) {
		db.setObjectField('config', 'submitPluginUsage', 0, callback);
	},
};
