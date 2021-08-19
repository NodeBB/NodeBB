'use strict';


const	async = require('async');
const assert = require('assert');
const db = require('../mocks/databasemock');

describe('Key methods', () => {
	beforeEach((done) => {
		db.set('testKey', 'testValue', done);
	});

	it('should set a key without error', (done) => {
		db.set('testKey', 'testValue', function (err) {
			assert.ifError(err);
			assert(arguments.length < 2);
			done();
		});
	});

	it('should get a key without error', (done) => {
		db.get('testKey', function (err, value) {
			assert.ifError(err);
			assert.equal(arguments.length, 2);
			assert.strictEqual(value, 'testValue');
			done();
		});
	});

	it('should return null if key does not exist', (done) => {
		db.get('doesnotexist', (err, value) => {
			assert.ifError(err);
			assert.equal(value, null);
			done();
		});
	});

	it('should return true if key exist', (done) => {
		db.exists('testKey', function (err, exists) {
			assert.ifError(err);
			assert.equal(arguments.length, 2);
			assert.strictEqual(exists, true);
			done();
		});
	});

	it('should return false if key does not exist', (done) => {
		db.exists('doesnotexist', function (err, exists) {
			assert.ifError(err);
			assert.equal(arguments.length, 2);
			assert.strictEqual(exists, false);
			done();
		});
	});

	it('should work for an array of keys', (done) => {
		db.exists(['testKey', 'doesnotexist'], (err, exists) => {
			assert.ifError(err);
			assert.deepStrictEqual(exists, [true, false]);
			done();
		});
	});

	describe('scan', () => {
		it('should scan keys for pattern', async () => {
			await db.sortedSetAdd('ip:123:uid', 1, 'a');
			await db.sortedSetAdd('ip:123:uid', 2, 'b');
			await db.sortedSetAdd('ip:124:uid', 2, 'b');
			await db.sortedSetAdd('ip:1:uid', 1, 'a');
			await db.sortedSetAdd('ip:23:uid', 1, 'a');
			const data = await db.scan({ match: 'ip:1*' });
			assert.equal(data.length, 3);
			assert(data.includes('ip:123:uid'));
			assert(data.includes('ip:124:uid'));
			assert(data.includes('ip:1:uid'));
		});
	});

	it('should delete a key without error', (done) => {
		db.delete('testKey', function (err) {
			assert.ifError(err);
			assert(arguments.length < 2);

			db.get('testKey', (err, value) => {
				assert.ifError(err);
				assert.equal(false, !!value);
				done();
			});
		});
	});

	it('should return false if key was deleted', (done) => {
		db.delete('testKey', function (err) {
			assert.ifError(err);
			assert(arguments.length < 2);
			db.exists('testKey', (err, exists) => {
				assert.ifError(err);
				assert.strictEqual(exists, false);
				done();
			});
		});
	});

	it('should delete all keys passed in', (done) => {
		async.parallel([
			function (next) {
				db.set('key1', 'value1', next);
			},
			function (next) {
				db.set('key2', 'value2', next);
			},
		], (err) => {
			if (err) {
				return done(err);
			}
			db.deleteAll(['key1', 'key2'], function (err) {
				assert.ifError(err);
				assert.equal(arguments.length, 1);
				async.parallel({
					key1exists: function (next) {
						db.exists('key1', next);
					},
					key2exists: function (next) {
						db.exists('key2', next);
					},
				}, (err, results) => {
					assert.ifError(err);
					assert.equal(results.key1exists, false);
					assert.equal(results.key2exists, false);
					done();
				});
			});
		});
	});

	it('should delete all sorted set elements', (done) => {
		async.parallel([
			function (next) {
				db.sortedSetAdd('deletezset', 1, 'value1', next);
			},
			function (next) {
				db.sortedSetAdd('deletezset', 2, 'value2', next);
			},
		], (err) => {
			if (err) {
				return done(err);
			}
			db.delete('deletezset', (err) => {
				assert.ifError(err);
				async.parallel({
					key1exists: function (next) {
						db.isSortedSetMember('deletezset', 'value1', next);
					},
					key2exists: function (next) {
						db.isSortedSetMember('deletezset', 'value2', next);
					},
				}, (err, results) => {
					assert.ifError(err);
					assert.equal(results.key1exists, false);
					assert.equal(results.key2exists, false);
					done();
				});
			});
		});
	});

	describe('increment', () => {
		it('should initialize key to 1', (done) => {
			db.increment('keyToIncrement', (err, value) => {
				assert.ifError(err);
				assert.strictEqual(parseInt(value, 10), 1);
				done();
			});
		});

		it('should increment key to 2', (done) => {
			db.increment('keyToIncrement', (err, value) => {
				assert.ifError(err);
				assert.strictEqual(parseInt(value, 10), 2);
				done();
			});
		});

		it('should set then increment a key', (done) => {
			db.set('myIncrement', 1, (err) => {
				assert.ifError(err);
				db.increment('myIncrement', (err, value) => {
					assert.ifError(err);
					assert.equal(value, 2);
					db.get('myIncrement', (err, value) => {
						assert.ifError(err);
						assert.equal(value, 2);
						done();
					});
				});
			});
		});

		it('should return the correct value', (done) => {
			db.increment('testingCache', (err) => {
				assert.ifError(err);
				db.get('testingCache', (err, value) => {
					assert.ifError(err);
					assert.equal(value, 1);
					db.increment('testingCache', (err) => {
						assert.ifError(err);
						db.get('testingCache', (err, value) => {
							assert.ifError(err);
							assert.equal(value, 2);
							done();
						});
					});
				});
			});
		});
	});

	describe('rename', () => {
		it('should rename key to new name', (done) => {
			db.set('keyOldName', 'renamedKeyValue', (err) => {
				if (err) {
					return done(err);
				}
				db.rename('keyOldName', 'keyNewName', function (err) {
					assert.ifError(err);
					assert(arguments.length < 2);

					db.get('keyNewName', (err, value) => {
						assert.ifError(err);
						assert.equal(value, 'renamedKeyValue');
						done();
					});
				});
			});
		});

		it('should rename multiple keys', (done) => {
			db.sortedSetAdd('zsettorename', [1, 2, 3], ['value1', 'value2', 'value3'], (err) => {
				assert.ifError(err);
				db.rename('zsettorename', 'newzsetname', (err) => {
					assert.ifError(err);
					db.exists('zsettorename', (err, exists) => {
						assert.ifError(err);
						assert(!exists);
						db.getSortedSetRange('newzsetname', 0, -1, (err, values) => {
							assert.ifError(err);
							assert.deepEqual(['value1', 'value2', 'value3'], values);
							done();
						});
					});
				});
			});
		});

		it('should not error if old key does not exist', (done) => {
			db.rename('doesnotexist', 'anotherdoesnotexist', (err) => {
				assert.ifError(err);
				db.exists('anotherdoesnotexist', (err, exists) => {
					assert.ifError(err);
					assert(!exists);
					done();
				});
			});
		});
	});

	describe('type', () => {
		it('should return null if key does not exist', (done) => {
			db.type('doesnotexist', (err, type) => {
				assert.ifError(err);
				assert.strictEqual(type, null);
				done();
			});
		});

		it('should return hash as type', (done) => {
			db.setObject('typeHash', { foo: 1 }, (err) => {
				assert.ifError(err);
				db.type('typeHash', (err, type) => {
					assert.ifError(err);
					assert.equal(type, 'hash');
					done();
				});
			});
		});

		it('should return zset as type', (done) => {
			db.sortedSetAdd('typeZset', 123, 'value1', (err) => {
				assert.ifError(err);
				db.type('typeZset', (err, type) => {
					assert.ifError(err);
					assert.equal(type, 'zset');
					done();
				});
			});
		});

		it('should return set as type', (done) => {
			db.setAdd('typeSet', 'value1', (err) => {
				assert.ifError(err);
				db.type('typeSet', (err, type) => {
					assert.ifError(err);
					assert.equal(type, 'set');
					done();
				});
			});
		});

		it('should return list as type', (done) => {
			db.listAppend('typeList', 'value1', (err) => {
				assert.ifError(err);
				db.type('typeList', (err, type) => {
					assert.ifError(err);
					assert.equal(type, 'list');
					done();
				});
			});
		});

		it('should return string as type', (done) => {
			db.set('typeString', 'value1', (err) => {
				assert.ifError(err);
				db.type('typeString', (err, type) => {
					assert.ifError(err);
					assert.equal(type, 'string');
					done();
				});
			});
		});

		it('should expire a key using seconds', (done) => {
			db.expire('testKey', 86400, (err) => {
				assert.ifError(err);
				db.ttl('testKey', (err, ttl) => {
					assert.ifError(err);
					assert.equal(Math.round(86400 / 1000), Math.round(ttl / 1000));
					done();
				});
			});
		});

		it('should expire a key using milliseconds', (done) => {
			db.pexpire('testKey', 86400000, (err) => {
				assert.ifError(err);
				db.pttl('testKey', (err, pttl) => {
					assert.ifError(err);
					assert.equal(Math.round(86400000 / 1000000), Math.round(pttl / 1000000));
					done();
				});
			});
		});
	});
});
