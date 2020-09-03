'use strict';

const assert = require('assert');

const db = require('./mocks/databasemock');
const upgrade = require('../src/upgrade');

describe('Upgrade', function () {
	it('should get all upgrade scripts', async function () {
		const files = await upgrade.getAll();
		assert(Array.isArray(files) && files.length > 0);
	});

	it('should throw error', async function () {
		let err;
		try {
			await upgrade.check();
		} catch (_err) {
			err = _err;
		}
		assert.equal(err.message, 'schema-out-of-date');
	});

	it('should run all upgrades', async function () {
		// for upgrade scripts to run
		await db.set('schemaDate', 1);
		await upgrade.run();
	});
});
