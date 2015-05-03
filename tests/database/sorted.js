'use strict';
/*global require, after, before*/

var	async = require('async'),
	assert = require('assert'),
	db = require('../mocks/databasemock');

describe('Sorted Set methods', function() {

	before(function(done) {
		async.parallel([
			function(next) {
				db.sortedSetAdd('sortedSetTest1', [1, 2, 3], ['value1', 'value2', 'value3'], next);
			},
			function(next) {
				db.sortedSetAdd('sortedSetTest2', [1, 4], ['value1', 'value4'], next);
			},
			function(next) {
				db.sortedSetAdd('sortedSetTest3', [2, 4], ['value2', 'value4'], next);
			}
		], done);
	});

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
			db.getSortedSetRange('sortedSetTest1', 0, 0, function(err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(value, 'value1');
				done();
			});
		});

		it('should return elements sorted by score lowest to highest', function(done) {
			db.getSortedSetRange('sortedSetTest1', 0, -1, function(err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value1', 'value2', 'value3']);
				done();
			});
		});
	});

	describe('getSortedSetRevRange()', function() {
		it('should return the highest scored element', function(done) {
			db.getSortedSetRevRange('sortedSetTest1', 0, 0, function(err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(value, 'value3');
				done();
			});
		});

		it('should return elements sorted by score highest to lowest', function(done) {
			db.getSortedSetRevRange('sortedSetTest1', 0, -1, function(err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value3', 'value2', 'value1']);
				done();
			});
		});
	});

	describe('getSortedSetRangeWithScores()', function() {
		it('should return array of elements sorted by score lowest to highest with scores', function(done) {
			db.getSortedSetRangeWithScores('sortedSetTest1', 0, -1, function(err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [{value: 'value1', score: 1}, {value: 'value2', score: 2}, {value: 'value3', score: 3}]);
				done();
			});
		});
	});

	describe('getSortedSetRevRangeWithScores()', function() {
		it('should return array of elements sorted by score highest to lowest with scores', function(done) {
			db.getSortedSetRevRangeWithScores('sortedSetTest1', 0, -1, function(err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [{value: 'value3', score: 3}, {value: 'value2', score: 2}, {value: 'value1', score: 1}]);
				done();
			});
		});
	});

	describe('getSortedSetRangeByScore()', function() {
		it('should get count elements with score between min max sorted by score lowest to highest', function(done) {
			db.getSortedSetRangeByScore('sortedSetTest1', 0, -1, '-inf', 2, function(err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value1', 'value2']);
				done();
			});
		});
	});

	describe('getSortedSetRevRangeByScore()', function() {
		it('should get count elements with score between max min sorted by score highest to lowest', function(done) {
			db.getSortedSetRevRangeByScore('sortedSetTest1', 0, -1, '+inf', 2, function(err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value3', 'value2']);
				done();
			});
		});
	});

	describe('getSortedSetRangeByScoreWithScores()', function() {
		it('should get count elements with score between min max sorted by score lowest to highest with scores', function(done) {
			db.getSortedSetRangeByScoreWithScores('sortedSetTest1', 0, -1, '-inf', 2, function(err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [{value: 'value1', score: 1}, {value: 'value2', score: 2}]);
				done();
			});
		});
	});

	describe('getSortedSetRevRangeByScoreWithScores()', function() {
		it('should get count elements with score between max min sorted by score highest to lowest', function(done) {
			db.getSortedSetRevRangeByScoreWithScores('sortedSetTest1', 0, -1, '+inf', 2, function(err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [{value: 'value3', score: 3}, {value: 'value2', score: 2}]);
				done();
			});
		});
	});

	describe('sortedSetCount()', function() {
		it('should return 0 for a sorted set that does not exist', function(done) {
			db.sortedSetCount('doesnotexist', 0, 10, function(err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(count, 0);
				done();
			});
		});

		it('should return number of elements between scores min max inclusive', function(done) {
			db.sortedSetCount('sortedSetTest1', '-inf', 2, function(err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(count, 2);
				done();
			});
		});

		it('should return number of elements between scores -inf +inf inclusive', function(done) {
			db.sortedSetCount('sortedSetTest1', '-inf', '+inf', function(err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(count, 3);
				done();
			});
		});
	});

	describe('sortedSetCard()', function() {
		it('should return 0 for a sorted set that does not exist', function(done) {
			db.sortedSetCard('doesnotexist', function(err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(count, 0);
				done();
			});
		});

		it('should return number of elements in a sorted set', function(done) {
			db.sortedSetCard('sortedSetTest1', function(err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(count, 3);
				done();
			});
		});
	});

	describe('sortedSetsCard()', function() {
		it('should return the number of elements in sorted sets', function(done) {
			db.sortedSetsCard(['sortedSetTest1', 'sortedSetTest2', 'doesnotexist'], function(err, counts) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(counts, [3, 2, 0]);
				done();
			});
		});
	});

	describe('sortedSetRank()', function() {
		it('should return falsy if sorted set does not exist', function(done) {
			db.sortedSetRank('doesnotexist', 'value1', function(err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!rank, false);
				done();
			});
		});

		it('should return falsy if element isnt in sorted set', function(done) {
			db.sortedSetRank('sortedSetTest1', 'value5', function(err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!rank, false);
				done();
			});
		});

		it('should return the rank of the element in the sorted set sorted by lowest to highest score', function(done) {
			db.sortedSetRank('sortedSetTest1', 'value1', function(err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(rank, 0);
				done();
			});
		});
	});

	describe('sortedSetRevRank()', function() {
		it('should return falsy if sorted set doesnot exist', function(done) {
			db.sortedSetRevRank('doesnotexist', 'value1', function(err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!rank, false);
				done();
			});
		});

		it('should return falsy if element isnt in sorted set', function(done) {
			db.sortedSetRevRank('sortedSetTest1', 'value5', function(err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!rank, false);
				done();
			});
		});

		it('should return the rank of the element in the sorted set sorted by highest to lowest score', function(done) {
			db.sortedSetRevRank('sortedSetTest1', 'value1', function(err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(rank, 2);
				done();
			});
		});
	});

	describe('sortedSetsRanks()', function() {
		it('should return the ranks of values in sorted sets', function(done) {
			db.sortedSetsRanks(['sortedSetTest1', 'sortedSetTest2'], ['value1', 'value4'], function(err, ranks) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(ranks, [0, 1]);
				done();
			});
		});
	});

	describe('sortedSetRanks()', function() {
		it('should return the ranks of values in a sorted set', function(done) {
			db.sortedSetRanks('sortedSetTest1', ['value2', 'value1', 'value3', 'value4'], function(err, ranks) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(ranks, [1, 0, 2, null]);
				done();
			});
		});
	});

	describe('sortedSetScore()', function() {
		it('should return falsy if sorted set does not exist', function(done) {
			db.sortedSetScore('doesnotexist', 'value1', function(err, score) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!score, false);
				done();
			});
		});

		it('should return falsy if element is not in sorted set', function(done) {
			db.sortedSetScore('sortedSetTest1', 'value5', function(err, score) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!score, false);
				done();
			});
		});

		it('should return the score of an element', function(done) {
			db.sortedSetScore('sortedSetTest1', 'value2', function(err, score) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(score, 2);
				done();
			});
		});
	});

	describe('sortedSetsScore()', function() {
		it('should return the scores of value in sorted sets', function(done) {
			db.sortedSetsScore(['sortedSetTest1', 'sortedSetTest2', 'doesnotexist'], 'value1', function(err, scores) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(scores, [1, 1, null]);
				done();
			});
		});
	});

	describe('sortedSetScores()', function() {
		it('should return the scores of value in sorted sets', function(done) {
			db.sortedSetScores('sortedSetTest1', ['value2', 'value1', 'doesnotexist'], function(err, scores) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(scores, [2, 1, null]);
				done();
			});
		});
	});

	describe('isSortedSetMember()', function() {
		before(function(done) {
			db.sortedSetAdd('zeroscore', 0, 'itemwithzeroscore', done);
		});

		it('should return false if sorted set does not exist', function(done) {
			db.isSortedSetMember('doesnotexist', 'value1', function(err, isMember) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(isMember, false);
				done();
			});
		});

		it('should return false if element is not in sorted set', function(done) {
			db.isSortedSetMember('sorted2', 'value5', function(err, isMember) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(isMember, false);
				done();
			});
		});

		it('should return true if element is in sorted set', function(done) {
			db.isSortedSetMember('sortedSetTest1', 'value2', function(err, isMember) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(isMember, true);
				done();
			});
		});

		it('should return true if element is in sorted set with score 0', function(done) {
			db.isSortedSetMember('zeroscore', 'itemwithzeroscore', function(err, isMember) {
				assert.ifError(err);
				assert.deepEqual(isMember, true);
				done();
			});
		});
	});

	describe('isSortedSetMembers()', function() {
		it('should return an array of booleans indicating membership', function(done) {
			db.isSortedSetMembers('sortedSetTest1', ['value1', 'value2', 'value5'], function(err, isMembers) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(isMembers, [true, true, false]);
				done();
			});
		});
	});

	describe('isMemberOfSortedSets', function() {
		it('should return true for members false for non members', function(done) {
			db.isMemberOfSortedSets(['doesnotexist', 'sortedSetTest1', 'sortedSetTest2'], 'value2', function(err, isMembers) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(isMembers, [false, true, false]);
				done();
			});
		});
	});

	describe('getSortedSetsMembers', function() {
		it('should return members of multiple sorted sets', function(done) {
			db.getSortedSetsMembers(['doesnotexist', 'sortedSetTest1'], function(err, sortedSets) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(sortedSets[0], []);
				sortedSets[0].forEach(function(element) {
					assert.notEqual(['value1', 'value2', 'value3'].indexOf(element), -1);
				});

				done();
			});
		});
	});

	describe('getSortedSetUnion()', function() {
		it('should return an array of values from both sorted sets sorted by scores lowest to highest', function(done) {
			db.getSortedSetUnion(['sortedSetTest2', 'sortedSetTest3'], 0, -1, function(err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value1', 'value2', 'value4']);
				done();
			});
		});
	});

	describe('getSortedSetRevUnion()', function() {
		it('should return an array of values from both sorted sets sorted by scores highest to lowest', function(done) {
			db.getSortedSetRevUnion(['sortedSetTest2', 'sortedSetTest3'], 0, -1, function(err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value4', 'value2', 'value1']);
				done();
			});
		});
	});

	describe('sortedSetIncrBy()', function() {
		it('should create a sorted set with a field set to 1', function(done) {
			db.sortedSetIncrBy('sortedIncr', 1, 'field1', function(err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, 1);
				db.sortedSetScore('sortedIncr', 'field1', function(err, score) {
					assert.equal(err, null);
					assert.equal(score, 1);
					done();
				});
			});
		});

		it('should increment a field of a sorted set by 5', function(done) {
			db.sortedSetIncrBy('sortedIncr', 5, 'field1', function(err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(newValue, 6);
				db.sortedSetScore('sortedIncr', 'field1', function(err, score) {
					assert.equal(err, null);
					assert.equal(score, 6);
					done();
				});
			});
		});
	});


	describe('sortedSetRemove()', function() {
		before(function(done) {
			db.sortedSetAdd('sorted3', [1, 2], ['value1', 'value2'], done);
		});

		it('should remove an element from a sorted set', function(done) {
			db.sortedSetRemove('sorted3', 'value2', function(err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				db.isSortedSetMember('sorted3', 'value2', function(err, isMember) {
					assert.equal(err, null);
					assert.equal(isMember, false);
					done();
				});
			});
		});
	});

	describe('sortedSetsRemove()', function() {
		before(function(done) {
			async.parallel([
				async.apply(db.sortedSetAdd, 'sorted4', [1,2], ['value1', 'value2']),
				async.apply(db.sortedSetAdd, 'sorted5', [1,2], ['value1', 'value3']),
			], done);
		});

		it('should remove element from multiple sorted sets', function(done) {
			db.sortedSetsRemove(['sorted4', 'sorted5'], 'value1', function(err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				db.sortedSetsScore(['sorted4', 'sorted5'], 'value1', function(err, scores) {
					assert.equal(err, null);
					assert.deepEqual(scores, [null, null]);
					done();
				});
			});
		});
	});

	describe('sortedSetsRemoveRangeByScore()', function() {
		before(function(done) {
			db.sortedSetAdd('sorted6', [1,2,3,4,5], ['value1','value2','value3','value4','value5'], done);
		});

		it('should remove elements with scores between min max inclusive', function(done) {
			db.sortedSetsRemoveRangeByScore(['sorted6'], 4, 5, function(err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				db.getSortedSetRange('sorted6', 0, -1, function(err, values) {
					assert.equal(err, null);
					assert.deepEqual(values, ['value1', 'value2', 'value3']);
					done();
				});
			});
		});
	});


	after(function() {
		db.flushdb();
	});
});
