'use strict';

var	async = require('async'),
	assert = require('assert'),
	db = require('../mocks/databasemock');

describe('Sorted Set methods', function() {

	describe('sortedSetAdd()', function() {

		it('should add an element to a sorted set', function(done) {
			db.sortedSetAdd('sorted1', 1, 'value1', function(err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});

		it('should add two elements to a sorted set', function(done) {
			db.sortedSetAdd('sorted2', [1, 2], ['value1', 'value2'], function(err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});
	});

	describe('sortedSetsAdd()', function() {
		it('should add an element to two sorted sets', function(done) {
			db.sortedSetsAdd(['sorted1, sorted2'], 3, 'value3', function(err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});
	});



	after(function() {
		db.flushdb();
	});
});
