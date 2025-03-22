'use strict';

const db = require('../../database');

module.exports = {
	name: 'Add setting for keeping original image after resize',
	timestamp: Date.UTC(2024, 11, 2),
	method: async function () {
		await db.setObjectField('config', 'resizeImageKeepOriginal', 1);
	},
};
