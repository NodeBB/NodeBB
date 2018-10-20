'use strict';


var	async = require('async');
var assert = require('assert');
var db = require('../mocks/databasemock');

describe('Key methods', function () {
	beforeEach(function (done) {
		db.set('testKey', 'testValue', done);
	});

	it('should set a key without error', function (done) {
		db.set('testKey', 'testValue', function (err) {
			assert.ifError(err);
			assert(arguments.length < 2);
			done();
		});
	});

	it('should get a key without error', function (done) {
		db.get('testKey', function (err, value) {
			assert.ifError(err);
			assert.equal(arguments.length, 2);
			assert.strictEqual(value, 'testValue');
			done();
		});
	});

	it('should return null if key does not exist', function (done) {
		db.get('doesnotexist', function (err, value) {
			assert.ifError(err);
			assert.equal(value, null);
			done();
		});
	});

	it('should return true if key exist', function (done) {
		db.exists('testKey', function (err, exists) {
			assert.ifError(err);
			assert.equal(arguments.length, 2);
			assert.strictEqual(exists, true);
			done();
		});
	});

	it('should return false if key does not exist', function (done) {
		db.exists('doesnotexist', function (err, exists) {
			assert.ifError(err);
			assert.equal(arguments.length, 2);
			assert.strictEqual(exists, false);
			done();
		});
	});

	it('should delete a key without error', function (done) {
		db.delete('testKey', function (err) {
			assert.ifError(err);
			assert(arguments.length < 2);

			db.get('testKey', function (err, value) {
				assert.ifError(err);
				assert.equal(false, !!value);
				done();
			});
		});
	});

	it('should return false if key was deleted', function (done) {
		db.delete('testKey', function (err) {
			assert.ifError(err);
			assert(arguments.length < 2);
			db.exists('testKey', function (err, exists) {
				assert.ifError(err);
				assert.strictEqual(exists, false);
				done();
			});
		});
	});

	it('should delete all keys passed in', function (done) {
		async.parallel([
			function (next) {
				db.set('key1', 'value1', next);
			},
			function (next) {
				db.set('key2', 'value2', next);
			},
		], function (err) {
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
				}, function (err, results) {
					assert.ifError(err);
					assert.equal(results.key1exists, false);
					assert.equal(results.key2exists, false);
					done();
				});
			});
		});
	});

	it('should delete all sorted set elements', function (done) {
		async.parallel([
			function (next) {
				db.sortedSetAdd('deletezset', 1, 'value1', next);
			},
			function (next) {
				db.sortedSetAdd('deletezset', 2, 'value2', next);
			},
		], function (err) {
			if (err) {
				return done(err);
			}
			db.delete('deletezset', function (err) {
				assert.ifError(err);
				async.parallel({
					key1exists: function (next) {
						db.isSortedSetMember('deletezset', 'value1', next);
					},
					key2exists: function (next) {
						db.isSortedSetMember('deletezset', 'value2', next);
					},
				}, function (err, results) {
					assert.ifError(err);
					assert.equal(results.key1exists, false);
					assert.equal(results.key2exists, false);
					done();
				});
			});
		});
	});

	describe('increment', function () {
		it('should initialize key to 1', function (done) {
			db.increment('keyToIncrement', function (err, value) {
				assert.ifError(err);
				assert.strictEqual(parseInt(value, 10), 1);
				done();
			});
		});

		it('should increment key to 2', function (done) {
			db.increment('keyToIncrement', function (err, value) {
				assert.ifError(err);
				assert.strictEqual(parseInt(value, 10), 2);
				done();
			});
		});

		it('should set then increment a key', function (done) {
			db.set('myIncrement', 1, function (err) {
				assert.ifError(err);
				db.increment('myIncrement', function (err, value) {
					assert.ifError(err);
					assert.equal(value, 2);
					db.get('myIncrement', function (err, value) {
						assert.ifError(err);
						assert.equal(value, 2);
						done();
					});
				});
			});
		});
	});

	describe('rename', function () {
		it('should rename key to new name', function (done) {
			db.set('keyOldName', 'renamedKeyValue', function (err) {
				if (err) {
					return done(err);
				}
				db.rename('keyOldName', 'keyNewName', function (err) {
					assert.ifError(err);
					assert(arguments.length < 2);

					db.get('keyNewName', function (err, value) {
						assert.ifError(err);
						assert.equal(value, 'renamedKeyValue');
						done();
					});
				});
			});
		});

		it('should rename multiple keys', function (done) {
			db.sortedSetAdd('zsettorename', [1, 2, 3], ['value1', 'value2', 'value3'], function (err) {
				assert.ifError(err);
				db.rename('zsettorename', 'newzsetname', function (err) {
					assert.ifError(err);
					db.exists('zsettorename', function (err, exists) {
						assert.ifError(err);
						assert(!exists);
						db.getSortedSetRange('newzsetname', 0, -1, function (err, values) {
							assert.ifError(err);
							assert.deepEqual(['value1', 'value2', 'value3'], values);
							done();
						});
					});
				});
			});
		});
	});

	describe('type', function () {
		it('should return null if key does not exist', function (done) {
			db.type('doesnotexist', function (err, type) {
				assert.ifError(err);
				assert.strictEqual(type, null);
				done();
			});
		});

		it('should return hash as type', function (done) {
			db.setObject('typeHash', { foo: 1 }, function (err) {
				assert.ifError(err);
				db.type('typeHash', function (err, type) {
					assert.ifError(err);
					assert.equal(type, 'hash');
					done();
				});
			});
		});

		it('should return zset as type', function (done) {
			db.sortedSetAdd('typeZset', 123, 'value1', function (err) {
				assert.ifError(err);
				db.type('typeZset', function (err, type) {
					assert.ifError(err);
					assert.equal(type, 'zset');
					done();
				});
			});
		});

		it('should return set as type', function (done) {
			db.setAdd('typeSet', 'value1', function (err) {
				assert.ifError(err);
				db.type('typeSet', function (err, type) {
					assert.ifError(err);
					assert.equal(type, 'set');
					done();
				});
			});
		});

		it('should return list as type', function (done) {
			db.listAppend('typeList', 'value1', function (err) {
				assert.ifError(err);
				db.type('typeList', function (err, type) {
					assert.ifError(err);
					assert.equal(type, 'list');
					done();
				});
			});
		});

		it('should return string as type', function (done) {
			db.set('typeString', 'value1', function (err) {
				assert.ifError(err);
				db.type('typeString', function (err, type) {
					assert.ifError(err);
					assert.equal(type, 'string');
					done();
				});
			});
		});
	});
});
