'use strict';

const path = require('path');
const fs = require('fs');
const db = require('./mocks/databasemock');

const installedPlugins = fs.readdirSync(path.join(__dirname, '../node_modules'))
	.filter(p => p.startsWith('nodebb-'));

describe('Installed Plugins', function () {
	installedPlugins.forEach((plugin) => {
		const pathToTests = path.join(__dirname, '../node_modules', plugin, 'test');
		try {
			require(pathToTests);
		} catch (err) {
			if (err.code !== 'MODULE_NOT_FOUND') {
				console.log(err.stack);
			}
		}
	});
});
