'use strict';

const async = require('async');
const assert = require('assert');

const db = require('./mocks/databasemock');

const cacheCreate = require('../src/cache/lru');

describe('cache', () => {
	it('should only call loader function once if key is same', () => {
		const cache = cacheCreate({ name: 'testCache1', max: 10 });
		let loadCount = 0;
		const loader = async () => {
			loadCount += 1;
			return 'value';
		};

		return Promise.all([
			cache.get('key', loader),
			cache.get('key', loader),
			cache.get('key', loader),
		]).then(([a, b, c]) => {
			assert.strictEqual(a, 'value');
			assert.strictEqual(b, 'value');
			assert.strictEqual(c, 'value');
			assert.strictEqual(loadCount, 1);
		});
	});

	it('should only call loader function once if keys are same', () => {
		const cache = cacheCreate({ name: 'testCache2', max: 10 });
		let loadCount = 0;
		const loader = async (keys) => {
			loadCount += 1;
			return keys.map(() => 'value');
		};

		return Promise.all([
			cache.getMany(['key1', 'key2'], loader),
			cache.getMany(['key1', 'key2'], loader),
			cache.getMany(['key1', 'key2'], loader),
		]).then(([a, b, c]) => {
			assert.deepStrictEqual(a, ['value', 'value']);
			assert.deepStrictEqual(b, ['value', 'value']);
			assert.deepStrictEqual(c, ['value', 'value']);
			assert.strictEqual(loadCount, 1);
		});
	});
});
