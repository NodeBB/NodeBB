'use strict';

const nconf = require('nconf');
const path = require('path');
const fs = require('fs');
const db = require('./mocks/databasemock');

const active = nconf.get('test_plugins') || [];
const toTest = fs.readdirSync(path.join(__dirname, '../node_modules'))
	.filter(p => p.startsWith('nodebb-') && active.includes(p));

describe('Installed Plugins', () => {
	toTest.forEach((plugin) => {
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
