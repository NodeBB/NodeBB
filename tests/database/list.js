'use strict';
/*global require, after, before*/

var	async = require('async'),
	assert = require('assert'),
	db = require('../mocks/databasemock');

describe('List methods', function() {

	describe('listAppend()', function() {
		it('should append to a list', function(done) {
			db.listAppend('testList1', 5, function(err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});
	});

	describe('listPrepend()', function() {
		it('should prepend to a list', function(done) {
			db.listPrepend('testList2', 3, function(err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
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
				assert.equal(err, null);
				done();
			});
		});
	});

	describe('getListRange()', function() {
		before(function(done) {
			async.series([
				function(next) {
					db.listAppend('testList3', 7, next);
				},
				function(next) {
					db.listPrepend('testList3', 3, next);
				},
				function(next) {
					db.listAppend('testList4', 5, next);
				}
			], done);
		});

		it('should return an empty list', function(done) {
			db.getListRange('doesnotexist', 0, -1, function(err, list) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(list), true);
				assert.equal(list.length, 0);
				done();
			});
		});

		it('should return a list with one element', function(done) {
			db.getListRange('testList4', 0, 0, function(err, list) {
				assert.equal(err, null);
				assert.equal(Array.isArray(list), true);
				assert.equal(list[0], 5);
				done();
			});
		});

		it('should return a list with 2 elements 3, 7', function(done) {
			db.getListRange('testList3', 0, -1, function(err, list) {
				assert.equal(err, null);
				assert.equal(Array.isArray(list), true);
				assert.equal(list.length, 2);
				assert.deepEqual(list, ['3', '7']);
				done();
			});
		});
	});

	describe('listRemoveLast()', function() {
		before(function(done) {
			async.series([
				function(next) {
					db.listAppend('testList4', 12, next);
				},
				function(next) {
					db.listPrepend('testList4', 9, next);
				}
			], done);
		});

		it('should remove the last element of list and return it', function(done) {
			db.listRemoveLast('testList4', function(err, lastElement) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(lastElement, '12');
				done();
			});
		});
	});

	describe('listRemoveAll()', function() {
		before(function(done) {
			async.series([
				async.apply(db.listAppend, 'testList5', 1),
				async.apply(db.listAppend, 'testList5', 1),
				async.apply(db.listAppend, 'testList5', 1),
				async.apply(db.listAppend, 'testList5', 2),
				async.apply(db.listAppend, 'testList5', 5)
			], done);
		});

		it('should remove all the matching elements of list', function(done) {
			db.listRemoveAll('testList5', '1', function(err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);

				db.getListRange('testList5', 0, -1, function(err, list) {
					assert.equal(Array.isArray(list), true);
					assert.equal(list.length, 2);
					assert.equal(list.indexOf('1'), -1);
					done();
				});
			});
		});
	});

	describe('listTrim()', function() {
		it('should trim list to a certain range', function(done) {
			var list = ['1', '2', '3', '4', '5'];
			async.eachSeries(list, function(value, next) {
				db.listAppend('testList6', value, next);
			}, function(err) {
				if (err) {
					return done(err);
				}

				db.listTrim('testList6', 0, 2, function(err) {
					assert.equal(err, null);
					assert.equal(arguments.length, 1);
					db.getListRange('testList6', 0, -1, function(err, list) {
						assert.equal(list.length, 3);
						assert.deepEqual(list, ['1', '2', '3']);
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
