'use strict';

var	async = require('async'),
	assert = require('assert'),
	db = require('../mocks/databasemock');

describe('List methods', function() {

	describe('listAppend()', function() {
		it('should append to a list', function(done) {
			db.listAppend('testList', 5, function(err) {
				assert.equal(err, null, 'db.listAppend error');
				assert.equal(arguments.length, 1, 'arguments.length error');
				done();
			});
		});
	});

	describe('listPrepend()', function() {
		it('should prepend to a list', function(done) {
			db.listPrepend('testList2', 3, function(err) {
				assert.equal(err, null, 'db.listPrepend error');
				assert.equal(arguments.length, 1, 'arguments.length error');
				done();
			});
		});

		it('should prepend 2 more elements to a list', function(done) {
			async.series([
				function(next) {
					db.listPrepend('testList2', 2, next);
				},
				function(next) {
					db.listPrepend('testList2', 1, next);
				}
			], function(err) {
				assert.equal(err, null, 'db.listPrepend error');
				done();
			});
		});
	});

	describe('getListRange()', function() {
		it('should return an empty list', function(done) {
			db.getListRange('doesnotexist', 0, -1, function(err, list) {
				assert.equal(err, null, 'db.getListRange error');
				assert.equal(arguments.length, 2, 'arguments.length error');
				assert.equal(Array.isArray(list), true, 'list is not an array');
				assert.equal(list.length, 0, 'list not empty');
				done();
			});
		});

		it('should return a list with one element', function(done) {
			db.getListRange('testList', 0, 0, function(err, list) {
				assert.equal(err, null, 'db.getListRange error');
				assert.equal(Array.isArray(list), true, 'list is not an array');
				assert.equal(list[0], 5, 'list does not have value');
				done();
			});
		});

		it('should return a list with 3 elements 1,2,3', function(done) {
			db.getListRange('testList2', 0, -1, function(err, list) {
				assert.equal(err, null, 'db.getListRange error');
				assert.equal(Array.isArray(list), true, 'list is not an array');
				assert.equal(list.length, 3, 'list length is not 3');
				assert.deepEqual(list, ['1', '2', '3'], 'lists not equal');
				done();
			});
		});
	});

	describe('listRemoveLast()', function() {
		it('should remove the last element of list', function(done) {
			db.listRemoveLast('testList2', function(err, lastElement) {
				assert.equal(err, null, 'db.listRemoveLast error');
				assert.equal(arguments.length, 2, 'arguments.length error');
				assert.equal(lastElement, '3', 'last element not correct');
				done();
			});
		});
	});

	describe('listRemoveAll()', function() {
		it('should remove all the elements of list', function(done) {
			db.listRemoveAll('testList2', function(err) {
				assert.equal(err, null, 'db.listRemoveAll error');
				assert.equal(arguments.length, 1, 'arguments.length error');

				db.getListRange('testList2', function(err, list) {
					assert.equal(Array.isArray(list), true, 'list is not an array');
					assert.equal(list.length, 0, 'list is not empty');
					done();
				});
			});
		});
	});

	describe('listTrim()', function() {
		it('should trim list to a certain range', function(done) {
			var list = ['1', '2', '3', '4', '5'];
			async.eachSeries(list, function(value, next) {
				db.listAppend('testList2', value, next);
			}, function(err) {
				if (err) {
					return done(err);
				}

				db.listTrim('testList2', 0, 2, function(err) {
					assert.equal(err, null, 'db.listTrim error');
					assert.equal(arguments.length, 1, 'arguments.length error');
					db.getListRange('testList2', 0, -1, function(err, list) {
						assert.equal(list.length, 3, 'list length is not 3');
						assert.deepEqual(list, ['1', '2', '3'], 'lists not properly trimmed');
					});
				});
			});
		});
	});


	after(function() {
		db.flushdb();
	});
});
