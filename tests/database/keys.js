
var	async = require('async'),
	assert = require('assert'),
	db = require('../mocks/databasemock');

describe('Key methods', function() {


	it('should set a key without error', function(done) {
		db.set('testKey', 'testValue', function(err) {
			assert.equal(err, null, 'db.set error');
			assert.equal(arguments.length, 1, 'db.set too many parameters returned');
			done();
		});
	});

	it('should get a key without error', function(done) {
		db.get('testKey', function(err, value) {
			assert.equal(err, null, 'db.get error');
			assert.equal(arguments.length, 2, 'db.get arguments.length error');
			assert.strictEqual(value, 'testValue', 'db.get returned value type is different');
			done();
		});
	});

	it('should return true if key exist', function(done) {
		db.exists('testKey', function(err, exists) {
			assert.equal(err, null, 'db.exists error');
			assert.equal(arguments.length, 2, 'db.exists arguments.length error');
			assert.strictEqual(exists, true, 'db.exists did not return true for existing key');
			done();
		});
	});

	it('should delete a key without error', function(done) {
		db.delete('testKey', function(err) {
			assert.equal(err, null, 'db.delete error');
			assert.equal(arguments.length, 1, 'db.delete arguments.length error');

			db.get('testKey', function(err, value) {
				assert.equal(err, null, 'db.get error');
				assert.equal(value, false, 'db.get deleted key is not falsy');
				done();
			});
		});
	});

	it('should return false if key does not exist or was deleted', function(done) {
		db.exists('testKey', function(err, exists) {
			assert.equal(err, null, 'db.exists error');
			assert.strictEqual(exists, false, 'db.exists did not return false for non-existing key');
			done();
		});
	});

	it('should delete all keys passed in', function(done) {
		async.parallel([
			function(next) {
				db.set('key1', 'value1', next);
			},
			function(next) {
				db.set('key2', 'value2', next);
			}
		], function(err) {
			if (err) {
				return done(err);
			}
			db.deleteAll(['key1', 'key2'], function(err) {
				assert.equal(err, null, 'db.deleteAll error');
				assert.equal(arguments.length, 1, 'arguments.length error');
				db.exists('key1', function(err, exists) {
					assert.equal(exists, false, 'deleted key is not falsy');
					done();
				});
			});
		});
	});

	describe('increment', function() {
		it('should initialize key to 1', function(done) {
			db.increment('keyToIncrement', function(err, value) {
				assert.equal(err, null, 'db.increment error');
				assert.strictEqual(parseInt(value, 10), 1, 'value not incremented');
				done();
			});
		});

		it('should increment key to 2', function(done) {
			db.increment('keyToIncrement', function(err, value) {
				assert.equal(err, null, 'db.increment error');
				assert.strictEqual(parseInt(value, 10), 2, 'value not incremented');
				done();
			});
		});
	});

	describe('rename', function() {
		it('should rename key to new name', function(done) {
			db.set('keyOldName', 'renamedKeyValue', function(err) {
				if (err) {
					return done(err);
				}
				db.rename('keyOldName', 'keyNewName', function(err) {
					assert.equal(err, null, 'db.rename error');
					assert.equal(arguments.length, 1, 'db.rename arguments.length error');

					db.get('keyNewName', function(err, value) {
						assert.equal(err, null, 'db.rename error');
						assert.equal(value, 'renamedKeyValue', 'renamed key value does not match');
						done();
					});
				});
			});
		});
	});


	after(function() {
		db.flushdb();
	});
});
