'use strict';

var	async = require('async'),
	assert = require('assert'),
	db = require('../mocks/databasemock');

describe('Set methods', function() {

	describe('setAdd()', function() {
		it('should add to a set', function(done) {
			db.setAdd('testSet', 5, function(err) {
				assert.equal(err, null, 'db.setAdd error');
				assert.equal(arguments.length, 1, 'arguments.length error');
				done();
			});
		});
	});

	describe('getSetMembers()', function() {
		it('should return an empty set', function(done) {
			db.getSetMembers('doesnotexist', function(err, set) {
				assert.equal(err, null, 'db.getSetMembers error');
				assert.equal(arguments.length, 2, 'arguments.length error');
				assert.equal(Array.isArray(set), true, 'set is not an array');
				assert.equal(set.length, 0, 'set not empty');
				done();
			});
		});

		it('should return a set with one element', function(done) {
			db.getSetMembers('testSet', function(err, set) {
				assert.equal(err, null, 'db.getSetMembers error');
				assert.equal(set.length, 1, 'set is empty');
				assert.strictEqual(set[0], '5' , 'set not empty');
				done();
			});
		});
	});

	describe('setsAdd()', function() {
		it('should add to multiple sets', function(done) {
			db.setsAdd(['set1', 'set2'], 'value', function(err) {
				assert.equal(err, null, 'db.setsAdd error');
				assert.equal(arguments.length, 1, 'arguments.length error');
				done();
			});
		});
	});

	describe('getSetsMembers', function() {
		it('should return members of two sets', function(done) {
			db.getSetsMembers(['set1', 'set2'], function(err, sets) {
				assert.equal(err, null, 'db.setsAdd error');
				assert.equal(Array.isArray(sets), true, 'sets is not an array');
				assert.equal(arguments.length, 2, 'arguments.length error');
				assert.equal(Array.isArray(sets[0]) && Array.isAray(sets[1]), true, 'sets not arrays');
				assert.strictEqual(sets[0][0], 'value', 'set value not correct');
				assert.strictEqual(sets[1][0], 'value', 'set value not correct');
				done();
			});
		});
	});



	after(function() {
		db.flushdb();
	});
});
