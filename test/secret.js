'use strict';

const assert = require('assert');
const nconf = require('nconf');

const db = require('./mocks/databasemock');
const meta = require('../src/meta');
const utils = require('../src/utils');

describe('secret', () => {
	const original = nconf.get('secret');

	afterEach(async () => {
		nconf.set('secret', original);
		await meta.secret.init();
	});

	after(() => {
		nconf.set('secret', original);
	});

	it('should be saved to the global hash', async () => {
		const stored = await db.getObjectField('global', 'secret');
		assert(stored);
		assert.equal(stored, nconf.get('secret'));
	});

	it('should prefer a configured secret over the saved value', async () => {
		const configured = utils.generateUUID();
		nconf.set('secret', configured);
		const resolved = await meta.secret.init();

		assert.equal(resolved, configured);
		// the configured secret is canonical, so it is saved to the database too
		assert.equal(await db.getObjectField('global', 'secret'), configured);
	});

	it('should generate a secret when none is configured or saved', async () => {
		nconf.set('secret', undefined);
		await db.setObjectField('global', 'secret', '');

		const resolved = await meta.secret.init();
		assert(resolved);
		assert.match(resolved, /^[0-9a-f-]{36}$/);
		assert.equal(await db.getObjectField('global', 'secret'), resolved);
	});

	it('should be stable across invocations', async () => {
		const first = await meta.secret.init();
		const second = await meta.secret.init();
		assert.equal(first, second);
	});
});
