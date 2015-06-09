'use strict';
/*global require, after*/

var	async = require('async'),
	assert = require('assert'),
	db = require('../mocks/databasemock');

describe('Key methods', function() {

	beforeEach(function(done) {
		db.set('testKey', 'testValue', done);
	});

	it('should set a key without error', function(done) {
		db.set('testKey', 'testValue', function(err) {
			assert.equal(err, null);
			assert.equal(arguments.length, 1);
			done();
		});
	});

	it('should get a key without error', function(done) {
		db.get('testKey', function(err, value) {
			assert.equal(err, null);
			assert.equal(arguments.length, 2);
			assert.strictEqual(value, 'testValue');
			done();
		});
	});

	it('should return true if key exist', function(done) {
		db.exists('testKey', function(err, exists) {
			assert.equal(err, null);
			assert.equal(arguments.length, 2);
			assert.strictEqual(exists, true);
			done();
		});
	});

	it('should return false if key does not exist', function(done) {
		db.exists('doesnotexist', function(err, exists) {
			assert.equal(err, null);
			assert.equal(arguments.length, 2);
			assert.strictEqual(exists, false);
			done();
		});
	});

	it('should delete a key without error', function(done) {
		db.delete('testKey', function(err) {
			assert.equal(err, null);
			assert.equal(arguments.length, 1);

			db.get('testKey', function(err, value) {
				assert.equal(err, null);
				assert.equal(false, !!value);
				done();
			});
		});
	});

	it('should return false if key was deleted', function(done) {
		db.delete('testKey', function(err) {
			assert.equal(err, null);
			assert.equal(arguments.length, 1);
			db.exists('testKey', function(err, exists) {
				assert.equal(err, null);
				assert.strictEqual(exists, false);
				done();
			});
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
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				async.parallel({
					key1exists: function(next) {
						db.exists('key1', next);
					},
					key2exists: function(next) {
						db.exists('key2', next);
					}
				}, function(err, results) {
					assert.equal(err, null);
					assert.equal(results.key1exists, false);
					assert.equal(results.key2exists, false);
					done();
				});
			});
		});
	});

	describe('increment', function() {
		it('should initialize key to 1', function(done) {
			db.increment('keyToIncrement', function(err, value) {
				assert.equal(err, null);
				assert.strictEqual(parseInt(value, 10), 1);
				done();
			});
		});

		it('should increment key to 2', function(done) {
			db.increment('keyToIncrement', function(err, value) {
				assert.equal(err, null);
				assert.strictEqual(parseInt(value, 10), 2);
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
					assert.equal(err, null);
					assert.equal(arguments.length, 1);

					db.get('keyNewName', function(err, value) {
						assert.equal(err, null);
						assert.equal(value, 'renamedKeyValue');
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
