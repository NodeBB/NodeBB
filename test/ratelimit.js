'use strict';


const assert = require('assert');

const db = require('./mocks/databasemock');

const ratelimit = require('../src/ratelimit');

describe('ratelimit', () => {
	const key = 'test:ratelimit';

	afterEach(async () => {
		await db.delete(key);
	});

	it('should allow hits up to the maximum and refuse the next one', async () => {
		assert.strictEqual(await ratelimit.check(key, { window: 5000, max: 2 }), true);
		assert.strictEqual(await ratelimit.check(key, { window: 5000, max: 2 }), true);
		assert.strictEqual(await ratelimit.check(key, { window: 5000, max: 2 }), false);
	});

	it('should set the expiry on the first hit only', async () => {
		await ratelimit.check(key, { window: 5000, max: 5 });
		const ttl = await db.pttl(key);
		assert(ttl > 0 && ttl <= 5000);

		await ratelimit.check(key, { window: 60000, max: 5 });
		const nextTtl = await db.pttl(key);
		assert(nextTtl <= ttl);
	});

	it('should start over once cleared', async () => {
		await ratelimit.check(key, { window: 5000, max: 1 });
		assert.strictEqual(await ratelimit.check(key, { window: 5000, max: 1 }), false);

		await ratelimit.clear(key);
		assert.strictEqual(await ratelimit.check(key, { window: 5000, max: 1 }), true);
	});
});
