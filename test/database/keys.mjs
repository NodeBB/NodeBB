// database.test.mjs
import assert from 'assert';
import db from '../mocks/databasemock.mjs';

describe('Key methods', () => {
	beforeEach(async () => {
		await db.set('testKey', 'testValue');
	});

	it('should set a key without error', async () => {
		await db.set('testKey', 'testValue');
		assert.ok(true); // No error means test passes
	});

	it('should get a key without error', async () => {
		const value = await db.get('testKey');
		assert.strictEqual(value, 'testValue');
	});

	it('should return null if key does not exist', async () => {
		const value = await db.get('doesnotexist');
		assert.strictEqual(value, null);
	});

	it('should return multiple keys and null if key doesn\'t exist', async () => {
		const data = await db.mget(['doesnotexist', 'testKey']);
		assert.deepStrictEqual(data, [null, 'testValue']);
	});

	it('should return empty array if keys is empty array or falsy', async () => {
		assert.deepStrictEqual(await db.mget([]), []);
		assert.deepStrictEqual(await db.mget(false), []);
		assert.deepStrictEqual(await db.mget(null), []);
	});

	it('should return true if key exists', async () => {
		const exists = await db.exists('testKey');
		assert.strictEqual(exists, true);
	});

	it('should return false if key does not exist', async () => {
		const exists = await db.exists('doesnotexist');
		assert.strictEqual(exists, false);
	});

	it('should work for an array of keys', async () => {
		assert.deepStrictEqual(await db.exists(['testKey', 'doesnotexist']), [true, false]);
		assert.deepStrictEqual(await db.exists([]), []);
	});

	describe('scan', () => {
		it('should scan keys for pattern', async () => {
			await db.sortedSetAdd('ip:123:uid', 1, 'a');
			await db.sortedSetAdd('ip:123:uid', 2, 'b');
			await db.sortedSetAdd('ip:124:uid', 2, 'b');
			await db.sortedSetAdd('ip:1:uid', 1, 'a');
			await db.sortedSetAdd('ip:23:uid', 1, 'a');
			const data = await db.scan({ match: 'ip:1*' });
			assert.strictEqual(data.length, 3);
			assert.ok(data.includes('ip:123:uid'));
			assert.ok(data.includes('ip:124:uid'));
			assert.ok(data.includes('ip:1:uid'));
		});
	});

	it('should delete a key without error', async () => {
		await db.delete('testKey');
		const value = await db.get('testKey');
		assert.strictEqual(!!value, false);
	});

	it('should return false if key was deleted', async () => {
		await db.delete('testKey');
		const exists = await db.exists('testKey');
		assert.strictEqual(exists, false);
	});

	it('should delete all keys passed in', async () => {
		await Promise.all([
			db.set('key1', 'value1'),
			db.set('key2', 'value2'),
		]);

		await db.deleteAll(['key1', 'key2']);
		const [key1Exists, key2Exists] = await db.exists(['key1', 'key2']);
		assert.strictEqual(key1Exists, false);
		assert.strictEqual(key2Exists, false);
	});

	it('should delete all sorted set elements', async () => {
		await db.sortedSetAddBulk([
			['deletezset', 1, 'value1'],
			['deletezset', 2, 'value2'],
		]);

		await db.delete('deletezset');
		const [key1Exists, key2Exists] = await db.isSortedSetMembers('deletezset', ['value1', 'value2']);
		assert.strictEqual(key1Exists, false);
		assert.strictEqual(key2Exists, false);
	});

	describe('increment', () => {
		it('should initialize key to 1', async () => {
			const value = await db.increment('keyToIncrement');
			assert.strictEqual(parseInt(value, 10), 1);
		});

		it('should increment key to 2', async () => {
			const value = await db.increment('keyToIncrement');
			assert.strictEqual(parseInt(value, 10), 2);
		});

		it('should set then increment a key', async () => {
			await db.set('myIncrement', 1);
			const value = await db.increment('myIncrement');
			assert.strictEqual(value, 2);
			const finalValue = await db.get('myIncrement');
			assert.strictEqual(finalValue, '2');
		});

		it('should return the correct value', async () => {
			await db.increment('testingCache');
			assert.strictEqual(await db.get('testingCache'), '1');
			await db.increment('testingCache');
			assert.strictEqual(await db.get('testingCache'), '2');
		});
	});

	describe('rename', () => {
		it('should rename key to new name', async () => {
			await db.set('keyOldName', 'renamedKeyValue');
			await db.rename('keyOldName', 'keyNewName');
			const value = await db.get('keyNewName');
			assert.strictEqual(value, 'renamedKeyValue');
		});

		it('should rename multiple keys', async () => {
			await db.sortedSetAdd('zsettorename', [1, 2, 3], ['value1', 'value2', 'value3']);
			await db.rename('zsettorename', 'newzsetname');
			const exists = await db.exists('zsettorename');
			assert.strictEqual(exists, false);
			const values = await db.getSortedSetRange('newzsetname', 0, -1);
			assert.deepStrictEqual(values, ['value1', 'value2', 'value3']);
		});

		it('should not error if old key does not exist', async () => {
			await db.rename('doesnotexist', 'anotherdoesnotexist');
			const exists = await db.exists('anotherdoesnotexist');
			assert.strictEqual(exists, false);
		});
	});

	describe('type', () => {
		it('should return null if key does not exist', async () => {
			const type = await db.type('doesnotexist');
			assert.strictEqual(type, null);
		});

		it('should return hash as type', async () => {
			await db.setObject('typeHash', { foo: 1 });
			const type = await db.type('typeHash');
			assert.strictEqual(type, 'hash');
		});

		it('should return zset as type', async () => {
			await db.sortedSetAdd('typeZset', 123, 'value1');
			const type = await db.type('typeZset');
			assert.strictEqual(type, 'zset');
		});

		it('should return set as type', async () => {
			await db.setAdd('typeSet', 'value1');
			const type = await db.type('typeSet');
			assert.strictEqual(type, 'set');
		});

		it('should return list as type', async () => {
			await db.listAppend('typeList', 'value1');
			const type = await db.type('typeList');
			assert.strictEqual(type, 'list');
		});

		it('should return string as type', async () => {
			await db.set('typeString', 'value1');
			const type = await db.type('typeString');
			assert.strictEqual(type, 'string');
		});

		it('should expire a key using seconds', async () => {
			await db.expire('testKey', 86400);
			const ttl = await db.ttl('testKey');
			assert.strictEqual(Math.round(86400 / 1000), Math.round(ttl / 1000));
		});

		it('should expire a key using milliseconds', async () => {
			await db.pexpire('testKey', 86400000);
			const pttl = await db.pttl('testKey');
			assert.strictEqual(Math.round(86400000 / 1000000), Math.round(pttl / 1000000));
		});
	});
});