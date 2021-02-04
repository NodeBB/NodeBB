'use strict';


var	async = require('async');
var assert = require('assert');
var db = require('../mocks/databasemock');

describe('Sorted Set methods', () => {
	before((done) => {
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

	describe('sortedSetScan', () => {
		it('should find matches in sorted set containing substring', async () => {
			await db.sortedSetAdd('scanzset', [1, 2, 3, 4, 5, 6], ['aaaa', 'bbbb', 'bbcc', 'ddd', 'dddd', 'fghbc']);
			const data = await db.getSortedSetScan({
				key: 'scanzset',
				match: '*bc*',
			});
			assert(data.includes('bbcc'));
			assert(data.includes('fghbc'));
		});

		it('should find matches in sorted set with scores', async () => {
			const data = await db.getSortedSetScan({
				key: 'scanzset',
				match: '*bc*',
				withScores: true,
			});
			data.sort((a, b) => a.score - b.score);
			assert.deepStrictEqual(data, [{ value: 'bbcc', score: 3 }, { value: 'fghbc', score: 6 }]);
		});

		it('should find matches in sorted set with a limit', async () => {
			await db.sortedSetAdd('scanzset2', [1, 2, 3, 4, 5, 6], ['aaab', 'bbbb', 'bbcb', 'ddb', 'dddd', 'fghbc']);
			const data = await db.getSortedSetScan({
				key: 'scanzset2',
				match: '*b*',
				limit: 2,
			});
			assert.equal(data.length, 2);
		});

		it('should work for special characters', async () => {
			await db.sortedSetAdd('scanzset3', [1, 2, 3, 4, 5], ['aaab{', 'bbbb', 'bbcb{', 'ddb', 'dddd']);
			const data = await db.getSortedSetScan({
				key: 'scanzset3',
				match: '*b{',
				limit: 2,
			});
			assert(data.includes('aaab{'));
			assert(data.includes('bbcb{'));
		});

		it('should find everything starting with string', async () => {
			await db.sortedSetAdd('scanzset4', [1, 2, 3, 4, 5], ['aaab{', 'bbbb', 'bbcb', 'ddb', 'dddd']);
			const data = await db.getSortedSetScan({
				key: 'scanzset4',
				match: 'b*',
				limit: 2,
			});
			assert(data.includes('bbbb'));
			assert(data.includes('bbcb'));
		});

		it('should find everything ending with string', async () => {
			await db.sortedSetAdd('scanzset5', [1, 2, 3, 4, 5, 6], ['aaab{', 'bbbb', 'bbcb', 'ddb', 'dddd', 'adb']);
			const data = await db.getSortedSetScan({
				key: 'scanzset5',
				match: '*db',
			});
			assert.equal(data.length, 2);
			assert(data.includes('ddb'));
			assert(data.includes('adb'));
		});
	});

	describe('sortedSetAdd()', () => {
		it('should add an element to a sorted set', (done) => {
			db.sortedSetAdd('sorted1', 1, 'value1', function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});

		it('should add two elements to a sorted set', (done) => {
			db.sortedSetAdd('sorted2', [1, 2], ['value1', 'value2'], function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});

		it('should gracefully handle adding the same element twice', (done) => {
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

		it('should error if score is null', (done) => {
			db.sortedSetAdd('errorScore', null, 'value1', (err) => {
				assert.equal(err.message, '[[error:invalid-score, null]]');
				done();
			});
		});

		it('should error if any score is undefined', (done) => {
			db.sortedSetAdd('errorScore', [1, undefined], ['value1', 'value2'], (err) => {
				assert.equal(err.message, '[[error:invalid-score, undefined]]');
				done();
			});
		});

		it('should add null value as `null` string', (done) => {
			db.sortedSetAdd('nullValueZSet', 1, null, (err) => {
				assert.ifError(err);
				db.getSortedSetRange('nullValueZSet', 0, -1, (err, values) => {
					assert.ifError(err);
					assert.strictEqual(values[0], 'null');
					done();
				});
			});
		});
	});

	describe('sortedSetsAdd()', () => {
		it('should add an element to two sorted sets', (done) => {
			db.sortedSetsAdd(['sorted1', 'sorted2'], 3, 'value3', function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});

		it('should add an element to two sorted sets with different scores', (done) => {
			db.sortedSetsAdd(['sorted1', 'sorted2'], [4, 5], 'value4', (err) => {
				assert.ifError(err);
				db.sortedSetsScore(['sorted1', 'sorted2'], 'value4', (err, scores) => {
					assert.ifError(err);
					assert.deepStrictEqual(scores, [4, 5]);
					done();
				});
			});
		});


		it('should error if keys.length is different than scores.length', (done) => {
			db.sortedSetsAdd(['sorted1', 'sorted2'], [4], 'value4', (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should error if score is null', (done) => {
			db.sortedSetsAdd(['sorted1', 'sorted2'], null, 'value1', (err) => {
				assert.equal(err.message, '[[error:invalid-score, null]]');
				done();
			});
		});

		it('should error if scores has null', async () => {
			let err;
			try {
				await db.sortedSetsAdd(['sorted1', 'sorted2'], [1, null], 'dontadd');
			} catch (_err) {
				err = _err;
			}
			assert.equal(err.message, '[[error:invalid-score, 1,]]');
			assert.strictEqual(await db.isSortedSetMember('sorted1', 'dontadd'), false);
			assert.strictEqual(await db.isSortedSetMember('sorted2', 'dontadd'), false);
		});
	});

	describe('sortedSetAddMulti()', () => {
		it('should add elements into multiple sorted sets with different scores', (done) => {
			db.sortedSetAddBulk([
				['bulk1', 1, 'item1'],
				['bulk2', 2, 'item1'],
				['bulk2', 3, 'item2'],
				['bulk3', 4, 'item3'],
			], function (err) {
				assert.ifError(err);
				assert.equal(arguments.length, 1);
				db.getSortedSetRevRangeWithScores(['bulk1', 'bulk2', 'bulk3'], 0, -1, (err, data) => {
					assert.ifError(err);
					assert.deepStrictEqual(data, [{ value: 'item3', score: 4 },
						{ value: 'item2', score: 3 },
						{ value: 'item1', score: 2 },
						{ value: 'item1', score: 1 }]);
					done();
				});
			});
		});
		it('should not error if data is undefined', (done) => {
			db.sortedSetAddBulk(undefined, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should error if score is null', async () => {
			let err;
			try {
				await db.sortedSetAddBulk([
					['bulk4', 0, 'dontadd'],
					['bulk5', null, 'dontadd'],
				]);
			} catch (_err) {
				err = _err;
			}
			assert.equal(err.message, '[[error:invalid-score, null]]');
			assert.strictEqual(await db.isSortedSetMember('bulk4', 'dontadd'), false);
			assert.strictEqual(await db.isSortedSetMember('bulk5', 'dontadd'), false);
		});
	});

	describe('getSortedSetRange()', () => {
		it('should return the lowest scored element', (done) => {
			db.getSortedSetRange('sortedSetTest1', 0, 0, function (err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(value, ['value1']);
				done();
			});
		});

		it('should return elements sorted by score lowest to highest', (done) => {
			db.getSortedSetRange('sortedSetTest1', 0, -1, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value1', 'value2', 'value3']);
				done();
			});
		});

		it('should return empty array if set does not exist', (done) => {
			db.getSortedSetRange('doesnotexist', 0, -1, (err, values) => {
				assert.ifError(err);
				assert(Array.isArray(values));
				assert.equal(values.length, 0);
				done();
			});
		});

		it('should handle negative start/stop', (done) => {
			db.sortedSetAdd('negatives', [1, 2, 3, 4, 5], ['1', '2', '3', '4', '5'], (err) => {
				assert.ifError(err);
				db.getSortedSetRange('negatives', -2, -4, (err, data) => {
					assert.ifError(err);
					assert.deepEqual(data, []);
					done();
				});
			});
		});

		it('should handle negative start/stop', (done) => {
			db.getSortedSetRange('negatives', -4, -2, (err, data) => {
				assert.ifError(err);
				assert.deepEqual(data, ['2', '3', '4']);
				done();
			});
		});

		it('should handle negative start/stop', (done) => {
			db.getSortedSetRevRange('negatives', -4, -2, (err, data) => {
				assert.ifError(err);
				assert.deepEqual(data, ['4', '3', '2']);
				done();
			});
		});

		it('should handle negative start/stop', (done) => {
			db.getSortedSetRange('negatives', -5, -1, (err, data) => {
				assert.ifError(err);
				assert.deepEqual(data, ['1', '2', '3', '4', '5']);
				done();
			});
		});

		it('should handle negative start/stop', (done) => {
			db.getSortedSetRange('negatives', 0, -2, (err, data) => {
				assert.ifError(err);
				assert.deepEqual(data, ['1', '2', '3', '4']);
				done();
			});
		});

		it('should return empty array if keys is empty array', (done) => {
			db.getSortedSetRange([], 0, -1, (err, data) => {
				assert.ifError(err);
				assert.deepStrictEqual(data, []);
				done();
			});
		});

		it('should return duplicates if two sets have same elements', async () => {
			await db.sortedSetAdd('dupezset1', [1, 2], ['value 1', 'value 2']);
			await db.sortedSetAdd('dupezset2', [2, 3], ['value 2', 'value 3']);
			const data = await db.getSortedSetRange(['dupezset1', 'dupezset2'], 0, -1);
			assert.deepStrictEqual(data, ['value 1', 'value 2', 'value 2', 'value 3']);
		});

		it('should return correct number of elements', async () => {
			await db.sortedSetAdd('dupezset3', [1, 2, 3], ['value 1', 'value 2', 'value3']);
			await db.sortedSetAdd('dupezset4', [0, 5], ['value 0', 'value5']);
			const data = await db.getSortedSetRevRange(['dupezset3', 'dupezset4'], 0, 1);
			assert.deepStrictEqual(data, ['value5', 'value3']);
		});

		it('should work with big arrays (length > 100) ', async function () {
			this.timeout(50000);
			const keys = [];
			for (let i = 0; i < 400; i++) {
				/* eslint-disable no-await-in-loop */
				const bulkAdd = [];
				keys.push(`testzset${i}`);
				for (let k = 0; k < 100; k++) {
					bulkAdd.push([`testzset${i}`, 1000000 + k + (i * 100), k + (i * 100)]);
				}
				await db.sortedSetAddBulk(bulkAdd);
			}

			let data = await db.getSortedSetRevRange(keys, 0, 3);
			assert.deepStrictEqual(data, ['39999', '39998', '39997', '39996']);

			data = await db.getSortedSetRevRangeWithScores(keys, 0, 3);
			assert.deepStrictEqual(data, [
				{ value: '39999', score: 1039999 },
				{ value: '39998', score: 1039998 },
				{ value: '39997', score: 1039997 },
				{ value: '39996', score: 1039996 },
			]);

			data = await db.getSortedSetRevRange(keys, 0, -1);
			assert.equal(data.length, 40000);

			data = await db.getSortedSetRange(keys, 9998, 10002);
			assert.deepStrictEqual(data, ['9998', '9999', '10000', '10001', '10002']);
		});
	});

	describe('getSortedSetRevRange()', () => {
		it('should return the highest scored element', (done) => {
			db.getSortedSetRevRange('sortedSetTest1', 0, 0, function (err, value) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(value, ['value3']);
				done();
			});
		});

		it('should return elements sorted by score highest to lowest', (done) => {
			db.getSortedSetRevRange('sortedSetTest1', 0, -1, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value3', 'value2', 'value1']);
				done();
			});
		});
	});

	describe('getSortedSetRangeWithScores()', () => {
		it('should return array of elements sorted by score lowest to highest with scores', (done) => {
			db.getSortedSetRangeWithScores('sortedSetTest1', 0, -1, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [{ value: 'value1', score: 1.1 }, { value: 'value2', score: 1.2 }, { value: 'value3', score: 1.3 }]);
				done();
			});
		});
	});

	describe('getSortedSetRevRangeWithScores()', () => {
		it('should return array of elements sorted by score highest to lowest with scores', (done) => {
			db.getSortedSetRevRangeWithScores('sortedSetTest1', 0, -1, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [{ value: 'value3', score: 1.3 }, { value: 'value2', score: 1.2 }, { value: 'value1', score: 1.1 }]);
				done();
			});
		});
	});

	describe('getSortedSetRangeByScore()', () => {
		it('should get count elements with score between min max sorted by score lowest to highest', (done) => {
			db.getSortedSetRangeByScore('sortedSetTest1', 0, -1, '-inf', 1.2, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value1', 'value2']);
				done();
			});
		});

		it('should return empty array if set does not exist', (done) => {
			db.getSortedSetRangeByScore('doesnotexist', 0, -1, '-inf', 0, (err, values) => {
				assert.ifError(err);
				assert(Array.isArray(values));
				assert.equal(values.length, 0);
				done();
			});
		});

		it('should return empty array if count is 0', (done) => {
			db.getSortedSetRevRangeByScore('sortedSetTest1', 0, 0, '+inf', '-inf', (err, values) => {
				assert.ifError(err);
				assert.deepEqual(values, []);
				done();
			});
		});

		it('should return elements from 1 to end', (done) => {
			db.getSortedSetRevRangeByScore('sortedSetTest1', 1, -1, '+inf', '-inf', (err, values) => {
				assert.ifError(err);
				assert.deepEqual(values, ['value2', 'value1']);
				done();
			});
		});

		it('should return elements from 3 to last', (done) => {
			db.sortedSetAdd('partialZset', [1, 2, 3, 4, 5], ['value1', 'value2', 'value3', 'value4', 'value5'], (err) => {
				assert.ifError(err);
				db.getSortedSetRangeByScore('partialZset', 3, 10, '-inf', '+inf', (err, data) => {
					assert.ifError(err);
					assert.deepStrictEqual(data, ['value4', 'value5']);
					done();
				});
			});
		});
	});

	describe('getSortedSetRevRangeByScore()', () => {
		it('should get count elements with score between max min sorted by score highest to lowest', (done) => {
			db.getSortedSetRevRangeByScore('sortedSetTest1', 0, -1, '+inf', 1.2, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value3', 'value2']);
				done();
			});
		});
	});

	describe('getSortedSetRangeByScoreWithScores()', () => {
		it('should get count elements with score between min max sorted by score lowest to highest with scores', (done) => {
			db.getSortedSetRangeByScoreWithScores('sortedSetTest1', 0, -1, '-inf', 1.2, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [{ value: 'value1', score: 1.1 }, { value: 'value2', score: 1.2 }]);
				done();
			});
		});
	});

	describe('getSortedSetRevRangeByScoreWithScores()', () => {
		it('should get count elements with score between max min sorted by score highest to lowest', (done) => {
			db.getSortedSetRevRangeByScoreWithScores('sortedSetTest1', 0, -1, '+inf', 1.2, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, [{ value: 'value3', score: 1.3 }, { value: 'value2', score: 1.2 }]);
				done();
			});
		});

		it('should work with an array of keys', async () => {
			await db.sortedSetAddBulk([
				['byScoreWithScoresKeys1', 1, 'value1'],
				['byScoreWithScoresKeys2', 2, 'value2'],
			]);
			const data = await db.getSortedSetRevRangeByScoreWithScores(['byScoreWithScoresKeys1', 'byScoreWithScoresKeys2'], 0, -1, 5, -5);
			assert.deepStrictEqual(data, [{ value: 'value2', score: 2 }, { value: 'value1', score: 1 }]);
		});
	});

	describe('sortedSetCount()', () => {
		it('should return 0 for a sorted set that does not exist', (done) => {
			db.sortedSetCount('doesnotexist', 0, 10, function (err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(count, 0);
				done();
			});
		});

		it('should return number of elements between scores min max inclusive', (done) => {
			db.sortedSetCount('sortedSetTest1', '-inf', 1.2, function (err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(count, 2);
				done();
			});
		});

		it('should return number of elements between scores -inf +inf inclusive', (done) => {
			db.sortedSetCount('sortedSetTest1', '-inf', '+inf', function (err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(count, 3);
				done();
			});
		});
	});

	describe('sortedSetCard()', () => {
		it('should return 0 for a sorted set that does not exist', (done) => {
			db.sortedSetCard('doesnotexist', function (err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(count, 0);
				done();
			});
		});

		it('should return number of elements in a sorted set', (done) => {
			db.sortedSetCard('sortedSetTest1', function (err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(count, 3);
				done();
			});
		});
	});

	describe('sortedSetsCard()', () => {
		it('should return the number of elements in sorted sets', (done) => {
			db.sortedSetsCard(['sortedSetTest1', 'sortedSetTest2', 'doesnotexist'], function (err, counts) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepEqual(counts, [3, 2, 0]);
				done();
			});
		});

		it('should return empty array if keys is falsy', (done) => {
			db.sortedSetsCard(undefined, function (err, counts) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepEqual(counts, []);
				done();
			});
		});

		it('should return empty array if keys is empty array', (done) => {
			db.sortedSetsCard([], function (err, counts) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepEqual(counts, []);
				done();
			});
		});
	});

	describe('sortedSetsCardSum()', () => {
		it('should return the total number of elements in sorted sets', (done) => {
			db.sortedSetsCardSum(['sortedSetTest1', 'sortedSetTest2', 'doesnotexist'], function (err, sum) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.equal(sum, 5);
				done();
			});
		});

		it('should return 0 if keys is falsy', (done) => {
			db.sortedSetsCardSum(undefined, function (err, counts) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepEqual(counts, 0);
				done();
			});
		});

		it('should return 0 if keys is empty array', (done) => {
			db.sortedSetsCardSum([], function (err, counts) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepEqual(counts, 0);
				done();
			});
		});

		it('should return the total number of elements in sorted set', (done) => {
			db.sortedSetsCardSum('sortedSetTest1', function (err, sum) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.equal(sum, 3);
				done();
			});
		});
	});

	describe('sortedSetRank()', () => {
		it('should return falsy if sorted set does not exist', (done) => {
			db.sortedSetRank('doesnotexist', 'value1', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!rank, false);
				done();
			});
		});

		it('should return falsy if element isnt in sorted set', (done) => {
			db.sortedSetRank('sortedSetTest1', 'value5', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!rank, false);
				done();
			});
		});

		it('should return the rank of the element in the sorted set sorted by lowest to highest score', (done) => {
			db.sortedSetRank('sortedSetTest1', 'value1', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(rank, 0);
				done();
			});
		});

		it('should return the rank sorted by the score and then the value (a)', (done) => {
			db.sortedSetRank('sortedSetTest4', 'a', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(rank, 0);
				done();
			});
		});

		it('should return the rank sorted by the score and then the value (b)', (done) => {
			db.sortedSetRank('sortedSetTest4', 'b', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(rank, 1);
				done();
			});
		});

		it('should return the rank sorted by the score and then the value (c)', (done) => {
			db.sortedSetRank('sortedSetTest4', 'c', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(rank, 4);
				done();
			});
		});
	});

	describe('sortedSetRevRank()', () => {
		it('should return falsy if sorted set doesnot exist', (done) => {
			db.sortedSetRevRank('doesnotexist', 'value1', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!rank, false);
				done();
			});
		});

		it('should return falsy if element isnt in sorted set', (done) => {
			db.sortedSetRevRank('sortedSetTest1', 'value5', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!rank, false);
				done();
			});
		});

		it('should return the rank of the element in the sorted set sorted by highest to lowest score', (done) => {
			db.sortedSetRevRank('sortedSetTest1', 'value1', function (err, rank) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(rank, 2);
				done();
			});
		});
	});

	describe('sortedSetsRanks()', () => {
		it('should return the ranks of values in sorted sets', (done) => {
			db.sortedSetsRanks(['sortedSetTest1', 'sortedSetTest2'], ['value1', 'value4'], function (err, ranks) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(ranks, [0, 1]);
				done();
			});
		});
	});

	describe('sortedSetRanks()', () => {
		it('should return the ranks of values in a sorted set', (done) => {
			db.sortedSetRanks('sortedSetTest1', ['value2', 'value1', 'value3', 'value4'], function (err, ranks) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(ranks, [1, 0, 2, null]);
				done();
			});
		});

		it('should return the ranks of values in a sorted set in reverse', (done) => {
			db.sortedSetRevRanks('sortedSetTest1', ['value2', 'value1', 'value3', 'value4'], function (err, ranks) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(ranks, [1, 2, 0, null]);
				done();
			});
		});
	});

	describe('sortedSetScore()', () => {
		it('should return falsy if sorted set does not exist', (done) => {
			db.sortedSetScore('doesnotexist', 'value1', function (err, score) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!score, false);
				assert.strictEqual(score, null);
				done();
			});
		});

		it('should return falsy if element is not in sorted set', (done) => {
			db.sortedSetScore('sortedSetTest1', 'value5', function (err, score) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(!!score, false);
				assert.strictEqual(score, null);
				done();
			});
		});

		it('should return the score of an element', (done) => {
			db.sortedSetScore('sortedSetTest1', 'value2', function (err, score) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.strictEqual(score, 1.2);
				done();
			});
		});

		it('should not error if key is undefined', (done) => {
			db.sortedSetScore(undefined, 1, (err, score) => {
				assert.ifError(err);
				assert.strictEqual(score, null);
				done();
			});
		});

		it('should not error if value is undefined', (done) => {
			db.sortedSetScore('sortedSetTest1', undefined, (err, score) => {
				assert.ifError(err);
				assert.strictEqual(score, null);
				done();
			});
		});
	});

	describe('sortedSetsScore()', () => {
		it('should return the scores of value in sorted sets', (done) => {
			db.sortedSetsScore(['sortedSetTest1', 'sortedSetTest2', 'doesnotexist'], 'value1', function (err, scores) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(scores, [1.1, 1, null]);
				done();
			});
		});

		it('should return scores even if some keys are undefined', (done) => {
			db.sortedSetsScore(['sortedSetTest1', undefined, 'doesnotexist'], 'value1', function (err, scores) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(scores, [1.1, null, null]);
				done();
			});
		});

		it('should return empty array if keys is empty array', (done) => {
			db.sortedSetsScore([], 'value1', function (err, scores) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(scores, []);
				done();
			});
		});
	});

	describe('sortedSetScores()', () => {
		before((done) => {
			db.sortedSetAdd('zeroScore', 0, 'value1', done);
		});

		it('should return 0 if score is 0', (done) => {
			db.sortedSetScores('zeroScore', ['value1'], (err, scores) => {
				assert.ifError(err);
				assert.strictEqual(scores[0], 0);
				done();
			});
		});

		it('should return the scores of value in sorted sets', (done) => {
			db.sortedSetScores('sortedSetTest1', ['value2', 'value1', 'doesnotexist'], function (err, scores) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepStrictEqual(scores, [1.2, 1.1, null]);
				done();
			});
		});

		it('should return scores even if some values are undefined', (done) => {
			db.sortedSetScores('sortedSetTest1', ['value2', undefined, 'doesnotexist'], function (err, scores) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepStrictEqual(scores, [1.2, null, null]);
				done();
			});
		});

		it('should return empty array if values is an empty array', (done) => {
			db.sortedSetScores('sortedSetTest1', [], function (err, scores) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepStrictEqual(scores, []);
				done();
			});
		});

		it('should return scores properly', (done) => {
			db.sortedSetsScore(['zeroScore', 'sortedSetTest1', 'doesnotexist'], 'value1', function (err, scores) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepStrictEqual(scores, [0, 1.1, null]);
				done();
			});
		});
	});

	describe('isSortedSetMember()', () => {
		before((done) => {
			db.sortedSetAdd('zeroscore', 0, 'itemwithzeroscore', done);
		});

		it('should return false if sorted set does not exist', (done) => {
			db.isSortedSetMember('doesnotexist', 'value1', function (err, isMember) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.equal(isMember, false);
				done();
			});
		});

		it('should return false if element is not in sorted set', (done) => {
			db.isSortedSetMember('sorted2', 'value5', function (err, isMember) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.equal(isMember, false);
				done();
			});
		});

		it('should return true if element is in sorted set', (done) => {
			db.isSortedSetMember('sortedSetTest1', 'value2', function (err, isMember) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.strictEqual(isMember, true);
				done();
			});
		});

		it('should return true if element is in sorted set with score 0', (done) => {
			db.isSortedSetMember('zeroscore', 'itemwithzeroscore', (err, isMember) => {
				assert.ifError(err);
				assert.strictEqual(isMember, true);
				done();
			});
		});
	});

	describe('isSortedSetMembers()', () => {
		it('should return an array of booleans indicating membership', (done) => {
			db.isSortedSetMembers('sortedSetTest1', ['value1', 'value2', 'value5'], function (err, isMembers) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(isMembers, [true, true, false]);
				done();
			});
		});

		it('should return true if element is in sorted set with score 0', (done) => {
			db.isSortedSetMembers('zeroscore', ['itemwithzeroscore'], function (err, isMembers) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepEqual(isMembers, [true]);
				done();
			});
		});
	});

	describe('isMemberOfSortedSets', () => {
		it('should return true for members false for non members', (done) => {
			db.isMemberOfSortedSets(['doesnotexist', 'sortedSetTest1', 'sortedSetTest2'], 'value2', function (err, isMembers) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(isMembers, [false, true, false]);
				done();
			});
		});

		it('should return empty array if keys is empty array', (done) => {
			db.isMemberOfSortedSets([], 'value2', function (err, isMembers) {
				assert.ifError(err);
				assert.equal(arguments.length, 2);
				assert.deepEqual(isMembers, []);
				done();
			});
		});
	});

	describe('getSortedSetsMembers', () => {
		it('should return members of a sorted set', async () => {
			const result = await db.getSortedSetMembers('sortedSetTest1');
			result.forEach((element) => {
				assert(['value1', 'value2', 'value3'].includes(element));
			});
		});

		it('should return members of multiple sorted sets', (done) => {
			db.getSortedSetsMembers(['doesnotexist', 'sortedSetTest1'], function (err, sortedSets) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(sortedSets[0], []);
				sortedSets[0].forEach((element) => {
					assert.notEqual(['value1', 'value2', 'value3'].indexOf(element), -1);
				});

				done();
			});
		});
	});

	describe('sortedSetUnionCard', () => {
		it('should return the number of elements in the union', (done) => {
			db.sortedSetUnionCard(['sortedSetTest2', 'sortedSetTest3'], (err, count) => {
				assert.ifError(err);
				assert.equal(count, 3);
				done();
			});
		});
	});

	describe('getSortedSetUnion()', () => {
		it('should return an array of values from both sorted sets sorted by scores lowest to highest', (done) => {
			db.getSortedSetUnion({ sets: ['sortedSetTest2', 'sortedSetTest3'], start: 0, stop: -1 }, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value1', 'value2', 'value4']);
				done();
			});
		});

		it('should return an array of values and scores from both sorted sets sorted by scores lowest to highest', (done) => {
			db.getSortedSetUnion({ sets: ['sortedSetTest2', 'sortedSetTest3'], start: 0, stop: -1, withScores: true }, function (err, data) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(data, [{ value: 'value1', score: 1 }, { value: 'value2', score: 2 }, { value: 'value4', score: 8 }]);
				done();
			});
		});
	});

	describe('getSortedSetRevUnion()', () => {
		it('should return an array of values from both sorted sets sorted by scores highest to lowest', (done) => {
			db.getSortedSetRevUnion({ sets: ['sortedSetTest2', 'sortedSetTest3'], start: 0, stop: -1 }, function (err, values) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.deepEqual(values, ['value4', 'value2', 'value1']);
				done();
			});
		});
	});

	describe('sortedSetIncrBy()', () => {
		it('should create a sorted set with a field set to 1', (done) => {
			db.sortedSetIncrBy('sortedIncr', 1, 'field1', function (err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.strictEqual(newValue, 1);
				db.sortedSetScore('sortedIncr', 'field1', (err, score) => {
					assert.equal(err, null);
					assert.strictEqual(score, 1);
					done();
				});
			});
		});

		it('should increment a field of a sorted set by 5', (done) => {
			db.sortedSetIncrBy('sortedIncr', 5, 'field1', function (err, newValue) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.strictEqual(newValue, 6);
				db.sortedSetScore('sortedIncr', 'field1', (err, score) => {
					assert.equal(err, null);
					assert.strictEqual(score, 6);
					done();
				});
			});
		});
	});


	describe('sortedSetRemove()', () => {
		before((done) => {
			db.sortedSetAdd('sorted3', [1, 2], ['value1', 'value2'], done);
		});

		it('should remove an element from a sorted set', (done) => {
			db.sortedSetRemove('sorted3', 'value2', function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				db.isSortedSetMember('sorted3', 'value2', (err, isMember) => {
					assert.equal(err, null);
					assert.equal(isMember, false);
					done();
				});
			});
		});

		it('should remove multiple values from multiple keys', (done) => {
			db.sortedSetAdd('multiTest1', [1, 2, 3, 4], ['one', 'two', 'three', 'four'], (err) => {
				assert.ifError(err);
				db.sortedSetAdd('multiTest2', [3, 4, 5, 6], ['three', 'four', 'five', 'six'], (err) => {
					assert.ifError(err);
					db.sortedSetRemove(['multiTest1', 'multiTest2'], ['two', 'three', 'four', 'five', 'doesnt exist'], (err) => {
						assert.ifError(err);
						db.getSortedSetsMembers(['multiTest1', 'multiTest2'], (err, members) => {
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

		it('should remove value from multiple keys', async () => {
			await db.sortedSetAdd('multiTest3', [1, 2, 3, 4], ['one', 'two', 'three', 'four']);
			await db.sortedSetAdd('multiTest4', [3, 4, 5, 6], ['three', 'four', 'five', 'six']);
			await db.sortedSetRemove(['multiTest3', 'multiTest4'], 'three');
			assert.deepStrictEqual(await db.getSortedSetRange('multiTest3', 0, -1), ['one', 'two', 'four']);
			assert.deepStrictEqual(await db.getSortedSetRange('multiTest4', 0, -1), ['four', 'five', 'six']);
		});

		it('should remove multiple values from multiple keys', (done) => {
			db.sortedSetAdd('multiTest5', [1], ['one'], (err) => {
				assert.ifError(err);
				db.sortedSetAdd('multiTest6', [2], ['two'], (err) => {
					assert.ifError(err);
					db.sortedSetAdd('multiTest7', [3], [333], (err) => {
						assert.ifError(err);
						db.sortedSetRemove(['multiTest5', 'multiTest6', 'multiTest7'], ['one', 'two', 333], (err) => {
							assert.ifError(err);
							db.getSortedSetsMembers(['multiTest5', 'multiTest6', 'multiTest7'], (err, members) => {
								assert.ifError(err);
								assert.deepEqual(members, [[], [], []]);
								done();
							});
						});
					});
				});
			});
		});

		it('should not remove anything if values is empty array', (done) => {
			db.sortedSetAdd('removeNothing', [1, 2, 3], ['val1', 'val2', 'val3'], (err) => {
				assert.ifError(err);
				db.sortedSetRemove('removeNothing', [], (err) => {
					assert.ifError(err);
					db.getSortedSetRange('removeNothing', 0, -1, (err, data) => {
						assert.ifError(err);
						assert.deepStrictEqual(data, ['val1', 'val2', 'val3']);
						done();
					});
				});
			});
		});

		it('should do a bulk remove', async () => {
			await db.sortedSetAddBulk([
				['bulkRemove1', 1, 'value1'],
				['bulkRemove1', 2, 'value2'],
				['bulkRemove2', 3, 'value2'],
			]);
			await db.sortedSetRemoveBulk([
				['bulkRemove1', 'value1'],
				['bulkRemove1', 'value2'],
				['bulkRemove2', 'value2'],
			]);
			const members = await db.getSortedSetsMembers(['bulkRemove1', 'bulkRemove2']);
			assert.deepStrictEqual(members, [[], []]);
		});
	});

	describe('sortedSetsRemove()', () => {
		before((done) => {
			async.parallel([
				async.apply(db.sortedSetAdd, 'sorted4', [1, 2], ['value1', 'value2']),
				async.apply(db.sortedSetAdd, 'sorted5', [1, 2], ['value1', 'value3']),
			], done);
		});

		it('should remove element from multiple sorted sets', (done) => {
			db.sortedSetsRemove(['sorted4', 'sorted5'], 'value1', function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				db.sortedSetsScore(['sorted4', 'sorted5'], 'value1', (err, scores) => {
					assert.equal(err, null);
					assert.deepStrictEqual(scores, [null, null]);
					done();
				});
			});
		});
	});

	describe('sortedSetsRemoveRangeByScore()', () => {
		before((done) => {
			db.sortedSetAdd('sorted6', [1, 2, 3, 4, 5], ['value1', 'value2', 'value3', 'value4', 'value5'], done);
		});

		it('should remove elements with scores between min max inclusive', (done) => {
			db.sortedSetsRemoveRangeByScore(['sorted6'], 4, 5, function (err) {
				assert.ifError(err);
				assert.equal(arguments.length, 1);
				db.getSortedSetRange('sorted6', 0, -1, (err, values) => {
					assert.ifError(err);
					assert.deepEqual(values, ['value1', 'value2', 'value3']);
					done();
				});
			});
		});

		it('should remove elements with if strin score is passed in', (done) => {
			db.sortedSetAdd('sortedForRemove', [11, 22, 33], ['value1', 'value2', 'value3'], (err) => {
				assert.ifError(err);
				db.sortedSetsRemoveRangeByScore(['sortedForRemove'], '22', '22', (err) => {
					assert.ifError(err);
					db.getSortedSetRange('sortedForRemove', 0, -1, (err, values) => {
						assert.ifError(err);
						assert.deepEqual(values, ['value1', 'value3']);
						done();
					});
				});
			});
		});
	});

	describe('getSortedSetIntersect', () => {
		before((done) => {
			async.parallel([
				function (next) {
					db.sortedSetAdd('interSet1', [1, 2, 3], ['value1', 'value2', 'value3'], next);
				},
				function (next) {
					db.sortedSetAdd('interSet2', [4, 5, 6], ['value2', 'value3', 'value5'], next);
				},
			], done);
		});

		it('should return the intersection of two sets', (done) => {
			db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: -1,
			}, (err, data) => {
				assert.ifError(err);
				assert.deepEqual(['value2', 'value3'], data);
				done();
			});
		});

		it('should return the intersection of two sets with scores', (done) => {
			db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: -1,
				withScores: true,
			}, (err, data) => {
				assert.ifError(err);
				assert.deepEqual([{ value: 'value2', score: 6 }, { value: 'value3', score: 8 }], data);
				done();
			});
		});

		it('should return the reverse intersection of two sets', (done) => {
			db.getSortedSetRevIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: 2,
			}, (err, data) => {
				assert.ifError(err);
				assert.deepEqual(['value3', 'value2'], data);
				done();
			});
		});

		it('should return the intersection of two sets with scores aggregate MIN', (done) => {
			db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: -1,
				withScores: true,
				aggregate: 'MIN',
			}, (err, data) => {
				assert.ifError(err);
				assert.deepEqual([{ value: 'value2', score: 2 }, { value: 'value3', score: 3 }], data);
				done();
			});
		});

		it('should return the intersection of two sets with scores aggregate MAX', (done) => {
			db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: -1,
				withScores: true,
				aggregate: 'MAX',
			}, (err, data) => {
				assert.ifError(err);
				assert.deepEqual([{ value: 'value2', score: 4 }, { value: 'value3', score: 5 }], data);
				done();
			});
		});

		it('should return the intersection with scores modified by weights', (done) => {
			db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: -1,
				withScores: true,
				weights: [1, 0.5],
			}, (err, data) => {
				assert.ifError(err);
				assert.deepEqual([{ value: 'value2', score: 4 }, { value: 'value3', score: 5.5 }], data);
				done();
			});
		});

		it('should return empty array if sets do not exist', (done) => {
			db.getSortedSetIntersect({
				sets: ['interSet10', 'interSet12'],
				start: 0,
				stop: -1,
			}, (err, data) => {
				assert.ifError(err);
				assert.equal(data.length, 0);
				done();
			});
		});

		it('should return empty array if one set does not exist', (done) => {
			db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet12'],
				start: 0,
				stop: -1,
			}, (err, data) => {
				assert.ifError(err);
				assert.equal(data.length, 0);
				done();
			});
		});

		it('should return correct results if sorting by different zset', async () => {
			await db.sortedSetAdd('bigzset', [1, 2, 3, 4, 5, 6], ['a', 'b', 'c', 'd', 'e', 'f']);
			await db.sortedSetAdd('smallzset', [3, 2, 1], ['b', 'e', 'g']);
			const data = await db.getSortedSetRevIntersect({
				sets: ['bigzset', 'smallzset'],
				start: 0,
				stop: 19,
				weights: [1, 0],
				withScores: true,
			});
			assert.deepStrictEqual(data, [{ value: 'e', score: 5 }, { value: 'b', score: 2 }]);
			const data2 = await db.getSortedSetRevIntersect({
				sets: ['bigzset', 'smallzset'],
				start: 0,
				stop: 19,
				weights: [0, 1],
				withScores: true,
			});
			assert.deepStrictEqual(data2, [{ value: 'b', score: 3 }, { value: 'e', score: 2 }]);
		});

		it('should return correct results when intersecting big zsets', async () => {
			const scores = [];
			const values = [];
			for (let i = 0; i < 30000; i++) {
				scores.push((i + 1) * 1000);
				values.push(String(i + 1));
			}
			await db.sortedSetAdd('verybigzset', scores, values);

			scores.length = 0;
			values.length = 0;
			for (let i = 15000; i < 45000; i++) {
				scores.push((i + 1) * 1000);
				values.push(String(i + 1));
			}
			await db.sortedSetAdd('anotherbigzset', scores, values);
			const data = await db.getSortedSetRevIntersect({
				sets: ['verybigzset', 'anotherbigzset'],
				start: 0,
				stop: 3,
				weights: [1, 0],
				withScores: true,
			});
			assert.deepStrictEqual(data, [
				{ value: '30000', score: 30000000 },
				{ value: '29999', score: 29999000 },
				{ value: '29998', score: 29998000 },
				{ value: '29997', score: 29997000 },
			]);
		});
	});

	describe('sortedSetIntersectCard', () => {
		before((done) => {
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

		it('should return # of elements in intersection', (done) => {
			db.sortedSetIntersectCard(['interCard1', 'interCard2', 'interCard3'], (err, count) => {
				assert.ifError(err);
				assert.strictEqual(count, 1);
				done();
			});
		});

		it('should return 0 if intersection is empty', (done) => {
			db.sortedSetIntersectCard(['interCard1', 'interCard4'], (err, count) => {
				assert.ifError(err);
				assert.strictEqual(count, 0);
				done();
			});
		});
	});

	describe('getSortedSetRangeByLex', () => {
		it('should return an array of all values', (done) => {
			db.getSortedSetRangeByLex('sortedSetLex', '-', '+', (err, data) => {
				assert.ifError(err);
				assert.deepEqual(data, ['a', 'b', 'c', 'd']);
				done();
			});
		});

		it('should return an array with an inclusive range by default', (done) => {
			db.getSortedSetRangeByLex('sortedSetLex', 'a', 'd', (err, data) => {
				assert.ifError(err);
				assert.deepEqual(data, ['a', 'b', 'c', 'd']);
				done();
			});
		});

		it('should return an array with an inclusive range', (done) => {
			db.getSortedSetRangeByLex('sortedSetLex', '[a', '[d', (err, data) => {
				assert.ifError(err);
				assert.deepEqual(data, ['a', 'b', 'c', 'd']);
				done();
			});
		});

		it('should return an array with an exclusive range', (done) => {
			db.getSortedSetRangeByLex('sortedSetLex', '(a', '(d', (err, data) => {
				assert.ifError(err);
				assert.deepEqual(data, ['b', 'c']);
				done();
			});
		});

		it('should return an array limited to the first two values', (done) => {
			db.getSortedSetRangeByLex('sortedSetLex', '-', '+', 0, 2, (err, data) => {
				assert.ifError(err);
				assert.deepEqual(data, ['a', 'b']);
				done();
			});
		});

		it('should return correct result', async () => {
			await db.sortedSetAdd('sortedSetLexSearch', [0, 0, 0], ['baris:usakli:1', 'baris usakli:2', 'baris soner:3']);
			const query = 'baris:';
			const min = query;
			const max = query.substr(0, query.length - 1) + String.fromCharCode(query.charCodeAt(query.length - 1) + 1);
			const result = await db.getSortedSetRangeByLex('sortedSetLexSearch', min, max, 0, -1);
			assert.deepStrictEqual(result, ['baris:usakli:1']);
		});
	});

	describe('getSortedSetRevRangeByLex', () => {
		it('should return an array of all values reversed', (done) => {
			db.getSortedSetRevRangeByLex('sortedSetLex', '+', '-', (err, data) => {
				assert.ifError(err);
				assert.deepEqual(data, ['d', 'c', 'b', 'a']);
				done();
			});
		});

		it('should return an array with an inclusive range by default reversed', (done) => {
			db.getSortedSetRevRangeByLex('sortedSetLex', 'd', 'a', (err, data) => {
				assert.ifError(err);
				assert.deepEqual(data, ['d', 'c', 'b', 'a']);
				done();
			});
		});

		it('should return an array with an inclusive range reversed', (done) => {
			db.getSortedSetRevRangeByLex('sortedSetLex', '[d', '[a', (err, data) => {
				assert.ifError(err);
				assert.deepEqual(data, ['d', 'c', 'b', 'a']);
				done();
			});
		});

		it('should return an array with an exclusive range reversed', (done) => {
			db.getSortedSetRevRangeByLex('sortedSetLex', '(d', '(a', (err, data) => {
				assert.ifError(err);
				assert.deepEqual(data, ['c', 'b']);
				done();
			});
		});

		it('should return an array limited to the first two values reversed', (done) => {
			db.getSortedSetRevRangeByLex('sortedSetLex', '+', '-', 0, 2, (err, data) => {
				assert.ifError(err);
				assert.deepEqual(data, ['d', 'c']);
				done();
			});
		});
	});

	describe('sortedSetLexCount', () => {
		it('should return the count of all values', (done) => {
			db.sortedSetLexCount('sortedSetLex', '-', '+', (err, data) => {
				assert.ifError(err);
				assert.strictEqual(data, 4);
				done();
			});
		});

		it('should return the count with an inclusive range by default', (done) => {
			db.sortedSetLexCount('sortedSetLex', 'a', 'd', (err, data) => {
				assert.ifError(err);
				assert.strictEqual(data, 4);
				done();
			});
		});

		it('should return the count with an inclusive range', (done) => {
			db.sortedSetLexCount('sortedSetLex', '[a', '[d', (err, data) => {
				assert.ifError(err);
				assert.strictEqual(data, 4);
				done();
			});
		});

		it('should return the count with an exclusive range', (done) => {
			db.sortedSetLexCount('sortedSetLex', '(a', '(d', (err, data) => {
				assert.ifError(err);
				assert.strictEqual(data, 2);
				done();
			});
		});
	});

	describe('sortedSetRemoveRangeByLex', () => {
		before((done) => {
			db.sortedSetAdd('sortedSetLex2', [0, 0, 0, 0, 0, 0, 0], ['a', 'b', 'c', 'd', 'e', 'f', 'g'], done);
		});

		it('should remove an inclusive range by default', (done) => {
			db.sortedSetRemoveRangeByLex('sortedSetLex2', 'a', 'b', function (err) {
				assert.ifError(err);
				assert.equal(arguments.length, 1);
				db.getSortedSetRangeByLex('sortedSetLex2', '-', '+', (err, data) => {
					assert.ifError(err);
					assert.deepEqual(data, ['c', 'd', 'e', 'f', 'g']);
					done();
				});
			});
		});

		it('should remove an inclusive range', (done) => {
			db.sortedSetRemoveRangeByLex('sortedSetLex2', '[c', '[d', function (err) {
				assert.ifError(err);
				assert.equal(arguments.length, 1);
				db.getSortedSetRangeByLex('sortedSetLex2', '-', '+', (err, data) => {
					assert.ifError(err);
					assert.deepEqual(data, ['e', 'f', 'g']);
					done();
				});
			});
		});

		it('should remove an exclusive range', (done) => {
			db.sortedSetRemoveRangeByLex('sortedSetLex2', '(e', '(g', function (err) {
				assert.ifError(err);
				assert.equal(arguments.length, 1);
				db.getSortedSetRangeByLex('sortedSetLex2', '-', '+', (err, data) => {
					assert.ifError(err);
					assert.deepEqual(data, ['e', 'g']);
					done();
				});
			});
		});

		it('should remove all values', (done) => {
			db.sortedSetRemoveRangeByLex('sortedSetLex2', '-', '+', function (err) {
				assert.ifError(err);
				assert.equal(arguments.length, 1);
				db.getSortedSetRangeByLex('sortedSetLex2', '-', '+', (err, data) => {
					assert.ifError(err);
					assert.deepEqual(data, []);
					done();
				});
			});
		});
	});
});
