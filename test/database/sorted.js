'use strict';


var	async = require('async');
var assert = require('assert');
var db = require('../mocks/databasemock');

describe('Sorted Set methods', function () {
	before(function (done) {
		async.parallel([
			function (next) {
				db.sortedSetAdd('sortedSetTest1', [1.1, 1.2, 1.3], ['value1', 'value2', 'value3'], next);
			},
			function (next) {
				db.sortedSetAdd('sortedSetTest2', [1, 4], ['value1', 'value4'], next);
			},
			function (next) {
				db.sortedSetAdd('sortedSetTest3', [2, 4], ['value2', 'value4'], next);
			},
			function (next) {
				db.sortedSetAdd('sortedSetTest4', [1, 1, 2, 3, 5], ['b', 'a', 'd', 'e', 'c'], next);
			},
			function (next) {
				db.sortedSetAdd('sortedSetLex', [0, 0, 0, 0], ['a', 'b', 'c', 'd'], next);
			},
		], done);
	});

	describe('sortedSetAdd()', function () {
		it('should add an element to a sorted set', function (done) {
			db.sortedSetAdd('sorted1', 1, 'value1', function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});

		it('should add two elements to a sorted set', function (done) {
			db.sortedSetAdd('sorted2', [1, 2], ['value1', 'value2'], function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});

		it('should gracefully handle adding the same element twice', function (done) {
			db.sortedSetAdd('sorted2', [1, 2], ['value1', 'value1'], function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);

				db.sortedSetScore('sorted2', 'value1', function (err, score) {
					assert.equal(err, null);
					assert.equal(score, 2);
					assert.equal(arguments.length, 2);

					done();
				});
			});
		});

		it('should error if score is null', function (done) {
			db.sortedSetAdd('errorScore', null, 'value1', function (err) {
				assert.equal(err.message, '[[error:invalid-score, null]]');
				done();
			});
		});

		it('should error if any score is undefined', function (done) {
			db.sortedSetAdd('errorScore', [1, undefined], ['value1', 'value2'], function (err) {
				assert.equal(err.message, '[[error:invalid-score, undefined]]');
				done();
			});
		});

		it('should add null value as `null` string', function (done) {
			db.sortedSetAdd('nullValueZSet', 1, null, function (err) {
				assert.ifError(err);
				db.getSortedSetRange('nullValueZSet', 0, -1, function (err, values) {
					assert.ifError(err);
					assert.strictEqual(values[0], 'null');
					done();
				});
			});
		});
	});

	describe('sortedSetsAdd()', function () {
		it('should add an element to two sorted sets', function (done) {
			db.sortedSetsAdd(['sorted1', 'sorted2'], 3, 'value3', function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});


		it('should error if score is null', function (done) {
			db.sortedSetsAdd(['sorted1', 'sorted2'], null, 'value1', function (err) {
				assert.equal(err.message, '[[error:invalid-score, null]]');
				done();
			});
		});
	});

	describe('getSortedSetRange()', function () {
		it('should return the lowest scored element', function (done) {
			db.getSortedSetRange('sortedSetTest1', 0, 0, function (err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(value, ['value1']);
				done();
			});
		});

		it('should return elements sorted by score lowest to highest', function (done) {
			db.getSortedSetRange('sortedSetTest1', 0, -1, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value1', 'value2', 'value3']);
				done();
			});
		});

		it('should return empty array if set does not exist', function (done) {
			db.getSortedSetRange('doesnotexist', 0, -1, function (err, values) {
				assert.ifError(err);
				assert(Array.isArray(values));
				assert.equal(values.length, 0);
				done();
			});
		});

		it('should handle negative start/stop', function (done) {
			db.sortedSetAdd('negatives', [1, 2, 3, 4, 5], ['1', '2', '3', '4', '5'], function (err) {
				assert.ifError(err);
				db.getSortedSetRange('negatives', -2, -4, function (err, data) {
					assert.ifError(err);
					assert.deepEqual(data, []);
					done();
				});
			});
		});

		it('should handle negative start/stop', function (done) {
			db.getSortedSetRange('negatives', -4, -2, function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, ['2', '3', '4']);
				done();
			});
		});

		it('should handle negative start/stop', function (done) {
			db.getSortedSetRevRange('negatives', -4, -2, function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, ['4', '3', '2']);
				done();
			});
		});

		it('should handle negative start/stop', function (done) {
			db.getSortedSetRange('negatives', -5, -1, function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, ['1', '2', '3', '4', '5']);
				done();
			});
		});

		it('should handle negative start/stop', function (done) {
			db.getSortedSetRange('negatives', 0, -2, function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, ['1', '2', '3', '4']);
				done();
			});
		});

		it('should return empty array if keys is empty array', function (done) {
			db.getSortedSetRange([], 0, -1, function (err, data) {
				assert.ifError(err);
				assert.deepStrictEqual(data, []);
				done();
			});
		});

		it('should return duplicates if two sets have same elements', function (done) {
			async.waterfall([
				function (next) {
					db.sortedSetAdd('dupezset1', [1, 2], ['value 1', 'value 2'], next);
				},
				function (next) {
					db.sortedSetAdd('dupezset2', [2, 3], ['value 2', 'value 3'], next);
				},
				function (next) {
					db.getSortedSetRange(['dupezset1', 'dupezset2'], 0, -1, next);
				},
				function (data, next) {
					assert.deepStrictEqual(data, ['value 1', 'value 2', 'value 2', 'value 3']);
					next();
				},
			], done);
		});
	});

	describe('getSortedSetRevRange()', function () {
		it('should return the highest scored element', function (done) {
			db.getSortedSetRevRange('sortedSetTest1', 0, 0, function (err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(value, ['value3']);
				done();
			});
		});

		it('should return elements sorted by score highest to lowest', function (done) {
			db.getSortedSetRevRange('sortedSetTest1', 0, -1, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value3', 'value2', 'value1']);
				done();
			});
		});
	});

	describe('getSortedSetRangeWithScores()', function () {
		it('should return array of elements sorted by score lowest to highest with scores', function (done) {
			db.getSortedSetRangeWithScores('sortedSetTest1', 0, -1, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [{ value: 'value1', score: 1.1 }, { value: 'value2', score: 1.2 }, { value: 'value3', score: 1.3 }]);
				done();
			});
		});
	});

	describe('getSortedSetRevRangeWithScores()', function () {
		it('should return array of elements sorted by score highest to lowest with scores', function (done) {
			db.getSortedSetRevRangeWithScores('sortedSetTest1', 0, -1, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [{ value: 'value3', score: 1.3 }, { value: 'value2', score: 1.2 }, { value: 'value1', score: 1.1 }]);
				done();
			});
		});
	});

	describe('getSortedSetRangeByScore()', function () {
		it('should get count elements with score between min max sorted by score lowest to highest', function (done) {
			db.getSortedSetRangeByScore('sortedSetTest1', 0, -1, '-inf', 1.2, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value1', 'value2']);
				done();
			});
		});

		it('should return empty array if set does not exist', function (done) {
			db.getSortedSetRangeByScore('doesnotexist', 0, -1, '-inf', 0, function (err, values) {
				assert.ifError(err);
				assert(Array.isArray(values));
				assert.equal(values.length, 0);
				done();
			});
		});

		it('should return empty array if count is 0', function (done) {
			db.getSortedSetRevRangeByScore('sortedSetTest1', 0, 0, '+inf', '-inf', function (err, values) {
				assert.ifError(err);
				assert.deepEqual(values, []);
				done();
			});
		});

		it('should return elements from 1 to end', function (done) {
			db.getSortedSetRevRangeByScore('sortedSetTest1', 1, -1, '+inf', '-inf', function (err, values) {
				assert.ifError(err);
				assert.deepEqual(values, ['value2', 'value1']);
				done();
			});
		});

		it('should return elements from 3 to last', function (done) {
			db.sortedSetAdd('partialZset', [1, 2, 3, 4, 5], ['value1', 'value2', 'value3', 'value4', 'value5'], function (err) {
				assert.ifError(err);
				db.getSortedSetRangeByScore('partialZset', 3, 10, '-inf', '+inf', function (err, data) {
					assert.ifError(err);
					assert.deepStrictEqual(data, ['value4', 'value5']);
					done();
				});
			});
		});
	});

	describe('getSortedSetRevRangeByScore()', function () {
		it('should get count elements with score between max min sorted by score highest to lowest', function (done) {
			db.getSortedSetRevRangeByScore('sortedSetTest1', 0, -1, '+inf', 1.2, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value3', 'value2']);
				done();
			});
		});
	});

	describe('getSortedSetRangeByScoreWithScores()', function () {
		it('should get count elements with score between min max sorted by score lowest to highest with scores', function (done) {
			db.getSortedSetRangeByScoreWithScores('sortedSetTest1', 0, -1, '-inf', 1.2, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [{ value: 'value1', score: 1.1 }, { value: 'value2', score: 1.2 }]);
				done();
			});
		});
	});

	describe('getSortedSetRevRangeByScoreWithScores()', function () {
		it('should get count elements with score between max min sorted by score highest to lowest', function (done) {
			db.getSortedSetRevRangeByScoreWithScores('sortedSetTest1', 0, -1, '+inf', 1.2, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [{ value: 'value3', score: 1.3 }, { value: 'value2', score: 1.2 }]);
				done();
			});
		});
	});

	describe('sortedSetCount()', function () {
		it('should return 0 for a sorted set that does not exist', function (done) {
			db.sortedSetCount('doesnotexist', 0, 10, function (err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(count, 0);
				done();
			});
		});

		it('should return number of elements between scores min max inclusive', function (done) {
			db.sortedSetCount('sortedSetTest1', '-inf', 1.2, function (err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(count, 2);
				done();
			});
		});

		it('should return number of elements between scores -inf +inf inclusive', function (done) {
			db.sortedSetCount('sortedSetTest1', '-inf', '+inf', function (err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(count, 3);
				done();
			});
		});
	});

	describe('sortedSetCard()', function () {
		it('should return 0 for a sorted set that does not exist', function (done) {
			db.sortedSetCard('doesnotexist', function (err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(count, 0);
				done();
			});
		});

		it('should return number of elements in a sorted set', function (done) {
			db.sortedSetCard('sortedSetTest1', function (err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(count, 3);
				done();
			});
		});
	});

	describe('sortedSetsCard()', function () {
		it('should return the number of elements in sorted sets', function (done) {
			db.sortedSetsCard(['sortedSetTest1', 'sortedSetTest2', 'doesnotexist'], function (err, counts) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(counts, [3, 2, 0]);
				done();
			});
		});

		it('should return empty array if keys is falsy', function (done) {
			db.sortedSetsCard(undefined, function (err, counts) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepEqual(counts, []);
				done();
			});
		});

		it('should return empty array if keys is empty array', function (done) {
			db.sortedSetsCard([], function (err, counts) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepEqual(counts, []);
				done();
			});
		});
	});

	describe('sortedSetRank()', function () {
		it('should return falsy if sorted set does not exist', function (done) {
			db.sortedSetRank('doesnotexist', 'value1', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!rank, false);
				done();
			});
		});

		it('should return falsy if element isnt in sorted set', function (done) {
			db.sortedSetRank('sortedSetTest1', 'value5', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!rank, false);
				done();
			});
		});

		it('should return the rank of the element in the sorted set sorted by lowest to highest score', function (done) {
			db.sortedSetRank('sortedSetTest1', 'value1', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(rank, 0);
				done();
			});
		});

		it('should return the rank sorted by the score and then the value (a)', function (done) {
			db.sortedSetRank('sortedSetTest4', 'a', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(rank, 0);
				done();
			});
		});

		it('should return the rank sorted by the score and then the value (b)', function (done) {
			db.sortedSetRank('sortedSetTest4', 'b', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(rank, 1);
				done();
			});
		});

		it('should return the rank sorted by the score and then the value (c)', function (done) {
			db.sortedSetRank('sortedSetTest4', 'c', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(rank, 4);
				done();
			});
		});
	});

	describe('sortedSetRevRank()', function () {
		it('should return falsy if sorted set doesnot exist', function (done) {
			db.sortedSetRevRank('doesnotexist', 'value1', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!rank, false);
				done();
			});
		});

		it('should return falsy if element isnt in sorted set', function (done) {
			db.sortedSetRevRank('sortedSetTest1', 'value5', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!rank, false);
				done();
			});
		});

		it('should return the rank of the element in the sorted set sorted by highest to lowest score', function (done) {
			db.sortedSetRevRank('sortedSetTest1', 'value1', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(rank, 2);
				done();
			});
		});
	});

	describe('sortedSetsRanks()', function () {
		it('should return the ranks of values in sorted sets', function (done) {
			db.sortedSetsRanks(['sortedSetTest1', 'sortedSetTest2'], ['value1', 'value4'], function (err, ranks) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(ranks, [0, 1]);
				done();
			});
		});
	});

	describe('sortedSetRanks()', function () {
		it('should return the ranks of values in a sorted set', function (done) {
			db.sortedSetRanks('sortedSetTest1', ['value2', 'value1', 'value3', 'value4'], function (err, ranks) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(ranks, [1, 0, 2, null]);
				done();
			});
		});
	});

	describe('sortedSetScore()', function () {
		it('should return falsy if sorted set does not exist', function (done) {
			db.sortedSetScore('doesnotexist', 'value1', function (err, score) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!score, false);
				assert.strictEqual(score, null);
				done();
			});
		});

		it('should return falsy if element is not in sorted set', function (done) {
			db.sortedSetScore('sortedSetTest1', 'value5', function (err, score) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!score, false);
				assert.strictEqual(score, null);
				done();
			});
		});

		it('should return the score of an element', function (done) {
			db.sortedSetScore('sortedSetTest1', 'value2', function (err, score) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.strictEqual(score, 1.2);
				done();
			});
		});

		it('should not error if key is undefined', function (done) {
			db.sortedSetScore(undefined, 1, function (err, score) {
				assert.ifError(err);
				assert.strictEqual(score, null);
				done();
			});
		});

		it('should not error if value is undefined', function (done) {
			db.sortedSetScore('sortedSetTest1', undefined, function (err, score) {
				assert.ifError(err);
				assert.strictEqual(score, null);
				done();
			});
		});
	});

	describe('sortedSetsScore()', function () {
		it('should return the scores of value in sorted sets', function (done) {
			db.sortedSetsScore(['sortedSetTest1', 'sortedSetTest2', 'doesnotexist'], 'value1', function (err, scores) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(scores, [1.1, 1, null]);
				done();
			});
		});

		it('should return scores even if some keys are undefined', function (done) {
			db.sortedSetsScore(['sortedSetTest1', undefined, 'doesnotexist'], 'value1', function (err, scores) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(scores, [1.1, null, null]);
				done();
			});
		});

		it('should return empty array if keys is empty array', function (done) {
			db.sortedSetsScore([], 'value1', function (err, scores) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(scores, []);
				done();
			});
		});
	});

	describe('sortedSetScores()', function () {
		before(function (done) {
			db.sortedSetAdd('zeroScore', 0, 'value1', done);
		});

		it('should return 0 if score is 0', function (done) {
			db.sortedSetScores('zeroScore', ['value1'], function (err, scores) {
				assert.ifError(err);
				assert.strictEqual(0, scores[0]);
				done();
			});
		});

		it('should return the scores of value in sorted sets', function (done) {
			db.sortedSetScores('sortedSetTest1', ['value2', 'value1', 'doesnotexist'], function (err, scores) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepStrictEqual(scores, [1.2, 1.1, null]);
				done();
			});
		});

		it('should return scores even if some values are undefined', function (done) {
			db.sortedSetScores('sortedSetTest1', ['value2', undefined, 'doesnotexist'], function (err, scores) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepStrictEqual(scores, [1.2, null, null]);
				done();
			});
		});

		it('should return empty array if values is an empty array', function (done) {
			db.sortedSetScores('sortedSetTest1', [], function (err, scores) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepStrictEqual(scores, []);
				done();
			});
		});

		it('should return scores properly', function (done) {
			db.sortedSetsScore(['zeroScore', 'sortedSetTest1', 'doesnotexist'], 'value1', function (err, scores) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepStrictEqual(scores, [0, 1.1, null]);
				done();
			});
		});
	});

	describe('isSortedSetMember()', function () {
		before(function (done) {
			db.sortedSetAdd('zeroscore', 0, 'itemwithzeroscore', done);
		});

		it('should return false if sorted set does not exist', function (done) {
			db.isSortedSetMember('doesnotexist', 'value1', function (err, isMember) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.equal(isMember, false);
				done();
			});
		});

		it('should return false if element is not in sorted set', function (done) {
			db.isSortedSetMember('sorted2', 'value5', function (err, isMember) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.equal(isMember, false);
				done();
			});
		});

		it('should return true if element is in sorted set', function (done) {
			db.isSortedSetMember('sortedSetTest1', 'value2', function (err, isMember) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.strictEqual(isMember, true);
				done();
			});
		});

		it('should return true if element is in sorted set with sre 0', function (done) {
			db.isSortedSetMember('zeroscore', 'itemwithzeroscore', function (err, isMember) {
				assert.ifError(err);
				assert.strictEqual(isMember, true);
				done();
			});
		});
	});

	describe('isSortedSetMembers()', function () {
		it('should return an array of booleans indicating membership', function (done) {
			db.isSortedSetMembers('sortedSetTest1', ['value1', 'value2', 'value5'], function (err, isMembers) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(isMembers, [true, true, false]);
				done();
			});
		});
	});

	describe('isMemberOfSortedSets', function () {
		it('should return true for members false for non members', function (done) {
			db.isMemberOfSortedSets(['doesnotexist', 'sortedSetTest1', 'sortedSetTest2'], 'value2', function (err, isMembers) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(isMembers, [false, true, false]);
				done();
			});
		});

		it('should return empty array if keys is empty array', function (done) {
			db.isMemberOfSortedSets([], 'value2', function (err, isMembers) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepEqual(isMembers, []);
				done();
			});
		});
	});

	describe('getSortedSetsMembers', function () {
		it('should return members of multiple sorted sets', function (done) {
			db.getSortedSetsMembers(['doesnotexist', 'sortedSetTest1'], function (err, sortedSets) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(sortedSets[0], []);
				sortedSets[0].forEach(function (element) {
					assert.notEqual(['value1', 'value2', 'value3'].indexOf(element), -1);
				});

				done();
			});
		});
	});

	describe('sortedSetUnionCard', function () {
		it('should return the number of elements in the union', function (done) {
			db.sortedSetUnionCard(['sortedSetTest2', 'sortedSetTest3'], function (err, count) {
				assert.ifError(err);
				assert.equal(count, 3);
				done();
			});
		});
	});

	describe('getSortedSetUnion()', function () {
		it('should return an array of values from both sorted sets sorted by scores lowest to highest', function (done) {
			db.getSortedSetUnion({ sets: ['sortedSetTest2', 'sortedSetTest3'], start: 0, stop: -1 }, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value1', 'value2', 'value4']);
				done();
			});
		});

		it('should return an array of values and scores from both sorted sets sorted by scores lowest to highest', function (done) {
			db.getSortedSetUnion({ sets: ['sortedSetTest2', 'sortedSetTest3'], start: 0, stop: -1, withScores: true }, function (err, data) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(data, [{ value: 'value1', score: 1 }, { value: 'value2', score: 2 }, { value: 'value4', score: 8 }]);
				done();
			});
		});
	});

	describe('getSortedSetRevUnion()', function () {
		it('should return an array of values from both sorted sets sorted by scores highest to lowest', function (done) {
			db.getSortedSetRevUnion({ sets: ['sortedSetTest2', 'sortedSetTest3'], start: 0, stop: -1 }, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value4', 'value2', 'value1']);
				done();
			});
		});
	});

	describe('sortedSetIncrBy()', function () {
		it('should create a sorted set with a field set to 1', function (done) {
			db.sortedSetIncrBy('sortedIncr', 1, 'field1', function (err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.strictEqual(newValue, 1);
				db.sortedSetScore('sortedIncr', 'field1', function (err, score) {
					assert.equal(err, null);
					assert.strictEqual(score, 1);
					done();
				});
			});
		});

		it('should increment a field of a sorted set by 5', function (done) {
			db.sortedSetIncrBy('sortedIncr', 5, 'field1', function (err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.strictEqual(newValue, 6);
				db.sortedSetScore('sortedIncr', 'field1', function (err, score) {
					assert.equal(err, null);
					assert.strictEqual(score, 6);
					done();
				});
			});
		});
	});


	describe('sortedSetRemove()', function () {
		before(function (done) {
			db.sortedSetAdd('sorted3', [1, 2], ['value1', 'value2'], done);
		});

		it('should remove an element from a sorted set', function (done) {
			db.sortedSetRemove('sorted3', 'value2', function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				db.isSortedSetMember('sorted3', 'value2', function (err, isMember) {
					assert.equal(err, null);
					assert.equal(isMember, false);
					done();
				});
			});
		});

		it('should remove multiple values from multiple keys', function (done) {
			db.sortedSetAdd('multiTest1', [1, 2, 3, 4], ['one', 'two', 'three', 'four'], function (err) {
				assert.ifError(err);
				db.sortedSetAdd('multiTest2', [3, 4, 5, 6], ['three', 'four', 'five', 'six'], function (err) {
					assert.ifError(err);
					db.sortedSetRemove(['multiTest1', 'multiTest2'], ['two', 'three', 'four', 'five', 'doesnt exist'], function (err) {
						assert.ifError(err);
						db.getSortedSetsMembers(['multiTest1', 'multiTest2'], function (err, members) {
							assert.ifError(err);
							assert.equal(members[0].length, 1);
							assert.equal(members[1].length, 1);
							assert.deepEqual(members, [['one'], ['six']]);
							done();
						});
					});
				});
			});
		});

		it('should remove value from multiple keys', function (done) {
			db.sortedSetAdd('multiTest3', [1, 2, 3, 4], ['one', 'two', 'three', 'four'], function (err) {
				assert.ifError(err);
				db.sortedSetAdd('multiTest4', [3, 4, 5, 6], ['three', 'four', 'five', 'six'], function (err) {
					assert.ifError(err);
					db.sortedSetRemove(['multiTest3', 'multiTest4'], 'three', function (err) {
						assert.ifError(err);
						db.getSortedSetsMembers(['multiTest3', 'multiTest4'], function (err, members) {
							assert.ifError(err);
							assert.deepEqual(members, [['one', 'two', 'four'], ['four', 'five', 'six']]);
							done();
						});
					});
				});
			});
		});

		it('should remove multiple values from multiple keys', function (done) {
			db.sortedSetAdd('multiTest5', [1], ['one'], function (err) {
				assert.ifError(err);
				db.sortedSetAdd('multiTest6', [2], ['two'], function (err) {
					assert.ifError(err);
					db.sortedSetAdd('multiTest7', [3], [333], function (err) {
						assert.ifError(err);
						db.sortedSetRemove(['multiTest5', 'multiTest6', 'multiTest7'], ['one', 'two', 333], function (err) {
							assert.ifError(err);
							db.getSortedSetsMembers(['multiTest5', 'multiTest6', 'multiTest7'], function (err, members) {
								assert.ifError(err);
								assert.deepEqual(members, [[], [], []]);
								done();
							});
						});
					});
				});
			});
		});
	});

	describe('sortedSetsRemove()', function () {
		before(function (done) {
			async.parallel([
				async.apply(db.sortedSetAdd, 'sorted4', [1, 2], ['value1', 'value2']),
				async.apply(db.sortedSetAdd, 'sorted5', [1, 2], ['value1', 'value3']),
			], done);
		});

		it('should remove element from multiple sorted sets', function (done) {
			db.sortedSetsRemove(['sorted4', 'sorted5'], 'value1', function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				db.sortedSetsScore(['sorted4', 'sorted5'], 'value1', function (err, scores) {
					assert.equal(err, null);
					assert.deepStrictEqual(scores, [null, null]);
					done();
				});
			});
		});
	});

	describe('sortedSetsRemoveRangeByScore()', function () {
		before(function (done) {
			db.sortedSetAdd('sorted6', [1, 2, 3, 4, 5], ['value1', 'value2', 'value3', 'value4', 'value5'], done);
		});

		it('should remove elements with scores between min max inclusive', function (done) {
			db.sortedSetsRemoveRangeByScore(['sorted6'], 4, 5, function (err) {
				assert.ifError(err);
				assert.equal(arguments.length, 1);
				db.getSortedSetRange('sorted6', 0, -1, function (err, values) {
					assert.ifError(err);
					assert.deepEqual(values, ['value1', 'value2', 'value3']);
					done();
				});
			});
		});

		it('should remove elements with if strin score is passed in', function (done) {
			db.sortedSetAdd('sortedForRemove', [11, 22, 33], ['value1', 'value2', 'value3'], function (err) {
				assert.ifError(err);
				db.sortedSetsRemoveRangeByScore(['sortedForRemove'], '22', '22', function (err) {
					assert.ifError(err);
					db.getSortedSetRange('sortedForRemove', 0, -1, function (err, values) {
						assert.ifError(err);
						assert.deepEqual(values, ['value1', 'value3']);
						done();
					});
				});
			});
		});
	});

	describe('getSortedSetIntersect', function () {
		before(function (done) {
			async.parallel([
				function (next) {
					db.sortedSetAdd('interSet1', [1, 2, 3], ['value1', 'value2', 'value3'], next);
				},
				function (next) {
					db.sortedSetAdd('interSet2', [4, 5, 6], ['value2', 'value3', 'value5'], next);
				},
			], done);
		});

		it('should return the intersection of two sets', function (done) {
			db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: -1,
			}, function (err, data) {
				assert.ifError(err);
				assert.deepEqual(['value2', 'value3'], data);
				done();
			});
		});

		it('should return the intersection of two sets with scores', function (done) {
			db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: -1,
				withScores: true,
			}, function (err, data) {
				assert.ifError(err);
				assert.deepEqual([{ value: 'value2', score: 6 }, { value: 'value3', score: 8 }], data);
				done();
			});
		});

		it('should return the reverse intersection of two sets', function (done) {
			db.getSortedSetRevIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: 2,
			}, function (err, data) {
				assert.ifError(err);
				assert.deepEqual(['value3', 'value2'], data);
				done();
			});
		});

		it('should return the intersection of two sets with scores aggregate MIN', function (done) {
			db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: -1,
				withScores: true,
				aggregate: 'MIN',
			}, function (err, data) {
				assert.ifError(err);
				assert.deepEqual([{ value: 'value2', score: 2 }, { value: 'value3', score: 3 }], data);
				done();
			});
		});

		it('should return the intersection of two sets with scores aggregate MAX', function (done) {
			db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: -1,
				withScores: true,
				aggregate: 'MAX',
			}, function (err, data) {
				assert.ifError(err);
				assert.deepEqual([{ value: 'value2', score: 4 }, { value: 'value3', score: 5 }], data);
				done();
			});
		});

		it('should return the intersection with scores modified by weights', function (done) {
			db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: -1,
				withScores: true,
				weights: [1, 0.5],
			}, function (err, data) {
				assert.ifError(err);
				assert.deepEqual([{ value: 'value2', score: 4 }, { value: 'value3', score: 5.5 }], data);
				done();
			});
		});

		it('should return empty array if sets do not exist', function (done) {
			db.getSortedSetIntersect({
				sets: ['interSet10', 'interSet12'],
				start: 0,
				stop: -1,
			}, function (err, data) {
				assert.ifError(err);
				assert.equal(data.length, 0);
				done();
			});
		});

		it('should return empty array if one set does not exist', function (done) {
			db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet12'],
				start: 0,
				stop: -1,
			}, function (err, data) {
				assert.ifError(err);
				assert.equal(data.length, 0);
				done();
			});
		});
	});

	describe('sortedSetIntersectCard', function () {
		before(function (done) {
			async.parallel([
				function (next) {
					db.sortedSetAdd('interCard1', [0, 0, 0], ['value1', 'value2', 'value3'], next);
				},
				function (next) {
					db.sortedSetAdd('interCard2', [0, 0, 0], ['value2', 'value3', 'value4'], next);
				},
				function (next) {
					db.sortedSetAdd('interCard3', [0, 0, 0], ['value3', 'value4', 'value5'], next);
				},
				function (next) {
					db.sortedSetAdd('interCard4', [0, 0, 0], ['value4', 'value5', 'value6'], next);
				},
			], done);
		});

		it('should return # of elements in intersection', function (done) {
			db.sortedSetIntersectCard(['interCard1', 'interCard2', 'interCard3'], function (err, count) {
				assert.ifError(err);
				assert.strictEqual(count, 1);
				done();
			});
		});

		it('should return 0 if intersection is empty', function (done) {
			db.sortedSetIntersectCard(['interCard1', 'interCard4'], function (err, count) {
				assert.ifError(err);
				assert.strictEqual(count, 0);
				done();
			});
		});
	});

	describe('getSortedSetRangeByLex', function () {
		it('should return an array of all values', function (done) {
			db.getSortedSetRangeByLex('sortedSetLex', '-', '+', function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, ['a', 'b', 'c', 'd']);
				done();
			});
		});

		it('should return an array with an inclusive range by default', function (done) {
			db.getSortedSetRangeByLex('sortedSetLex', 'a', 'd', function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, ['a', 'b', 'c', 'd']);
				done();
			});
		});

		it('should return an array with an inclusive range', function (done) {
			db.getSortedSetRangeByLex('sortedSetLex', '[a', '[d', function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, ['a', 'b', 'c', 'd']);
				done();
			});
		});

		it('should return an array with an exclusive range', function (done) {
			db.getSortedSetRangeByLex('sortedSetLex', '(a', '(d', function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, ['b', 'c']);
				done();
			});
		});

		it('should return an array limited to the first two values', function (done) {
			db.getSortedSetRangeByLex('sortedSetLex', '-', '+', 0, 2, function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, ['a', 'b']);
				done();
			});
		});
	});

	describe('getSortedSetRevRangeByLex', function () {
		it('should return an array of all values reversed', function (done) {
			db.getSortedSetRevRangeByLex('sortedSetLex', '+', '-', function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, ['d', 'c', 'b', 'a']);
				done();
			});
		});

		it('should return an array with an inclusive range by default reversed', function (done) {
			db.getSortedSetRevRangeByLex('sortedSetLex', 'd', 'a', function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, ['d', 'c', 'b', 'a']);
				done();
			});
		});

		it('should return an array with an inclusive range reversed', function (done) {
			db.getSortedSetRevRangeByLex('sortedSetLex', '[d', '[a', function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, ['d', 'c', 'b', 'a']);
				done();
			});
		});

		it('should return an array with an exclusive range reversed', function (done) {
			db.getSortedSetRevRangeByLex('sortedSetLex', '(d', '(a', function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, ['c', 'b']);
				done();
			});
		});

		it('should return an array limited to the first two values reversed', function (done) {
			db.getSortedSetRevRangeByLex('sortedSetLex', '+', '-', 0, 2, function (err, data) {
				assert.ifError(err);
				assert.deepEqual(data, ['d', 'c']);
				done();
			});
		});
	});

	describe('sortedSetLexCount', function () {
		it('should return the count of all values', function (done) {
			db.sortedSetLexCount('sortedSetLex', '-', '+', function (err, data) {
				assert.ifError(err);
				assert.strictEqual(data, 4);
				done();
			});
		});

		it('should return the count with an inclusive range by default', function (done) {
			db.sortedSetLexCount('sortedSetLex', 'a', 'd', function (err, data) {
				assert.ifError(err);
				assert.strictEqual(data, 4);
				done();
			});
		});

		it('should return the count with an inclusive range', function (done) {
			db.sortedSetLexCount('sortedSetLex', '[a', '[d', function (err, data) {
				assert.ifError(err);
				assert.strictEqual(data, 4);
				done();
			});
		});

		it('should return the count with an exclusive range', function (done) {
			db.sortedSetLexCount('sortedSetLex', '(a', '(d', function (err, data) {
				assert.ifError(err);
				assert.strictEqual(data, 2);
				done();
			});
		});
	});

	describe('sortedSetRemoveRangeByLex', function () {
		before(function (done) {
			db.sortedSetAdd('sortedSetLex2', [0, 0, 0, 0, 0, 0, 0], ['a', 'b', 'c', 'd', 'e', 'f', 'g'], done);
		});

		it('should remove an inclusive range by default', function (done) {
			db.sortedSetRemoveRangeByLex('sortedSetLex2', 'a', 'b', function (err) {
				assert.ifError(err);
				assert.equal(arguments.length, 1);
				db.getSortedSetRangeByLex('sortedSetLex2', '-', '+', function (err, data) {
					assert.ifError(err);
					assert.deepEqual(data, ['c', 'd', 'e', 'f', 'g']);
					done();
				});
			});
		});

		it('should remove an inclusive range', function (done) {
			db.sortedSetRemoveRangeByLex('sortedSetLex2', '[c', '[d', function (err) {
				assert.ifError(err);
				assert.equal(arguments.length, 1);
				db.getSortedSetRangeByLex('sortedSetLex2', '-', '+', function (err, data) {
					assert.ifError(err);
					assert.deepEqual(data, ['e', 'f', 'g']);
					done();
				});
			});
		});

		it('should remove an exclusive range', function (done) {
			db.sortedSetRemoveRangeByLex('sortedSetLex2', '(e', '(g', function (err) {
				assert.ifError(err);
				assert.equal(arguments.length, 1);
				db.getSortedSetRangeByLex('sortedSetLex2', '-', '+', function (err, data) {
					assert.ifError(err);
					assert.deepEqual(data, ['e', 'g']);
					done();
				});
			});
		});

		it('should remove all values', function (done) {
			db.sortedSetRemoveRangeByLex('sortedSetLex2', '-', '+', function (err) {
				assert.ifError(err);
				assert.equal(arguments.length, 1);
				db.getSortedSetRangeByLex('sortedSetLex2', '-', '+', function (err, data) {
					assert.ifError(err);
					assert.deepEqual(data, []);
					done();
				});
			});
		});
	});
});
