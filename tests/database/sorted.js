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
			db.sortedSetsAdd(['sorted1', 'sorted2'], 3, 'value3', function(err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});
	});

	describe('getSortedSetRange()', function() {
		it('should return the lowest scored element', function(done) {
			db.getSortedSetRange('sorted2', 0, 0, function(err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(value, 'value1');
				done();
			});
		});

		it('should return elements sorted by score lowest to highest', function(done) {
			db.getSortedSetRange('sorted2', 0, -1, function(err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value1', 'value2', 'value3']);
				done();
			});
		});
	});

	describe('getSortedSetRevRange()', function() {
		it('should return the highest scored element', function(done) {
			db.getSortedSetRevRange('sorted2', 0, 0, function(err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(value, 'value3');
				done();
			});
		});

		it('should return elements sorted by score highest to lowest', function(done) {
			db.getSortedSetRevRange('sorted2', 0, -1, function(err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value3', 'value2', 'value1']);
				done();
			});
		});
	});

	describe('getSortedSetRangeWithScores()', function() {
		it('should return array of elements sorted by score lowest to highest with scores', function(done) {
			db.getSortedSetRangeWithScores('sorted2', 0, -1, function(err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [{value: 'value1', score: 1}, {value: 'value2', score: 2}, {value: 'value3', score: 3}]);
				done();
			});
		});
	});

	describe('getSortedSetRevRangeWithScores()', function() {
		it('should return array of elements sorted by score highest to lowest with scores', function(done) {
			db.getSortedSetRevRangeWithScores('sorted2', 0, -1, function(err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [{value: 'value3', score: 3}, {value: 'value2', score: 2}, {value: 'value1', score: 1}]);
				done();
			});
		});
	});


	after(function() {
		db.flushdb();
	});
});
