'use strict';

const assert = require('assert');

const db = require('./mocks/databasemock');
const upgrade = require('../src/upgrade');

describe('Upgrade', function () {
	it('should get all upgrade scripts', async function () {
		const files = await upgrade.getAll();
		assert(Array.isArray(files) && files.length > 0);
	});
});
