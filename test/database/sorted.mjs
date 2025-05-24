import assert from 'node:assert/strict';
import db from '../mocks/databasemock.mjs';

describe('Database/Sorted Set', () => {
	before(async () => {
		await Promise.all([
			db.sortedSetAdd('sortedSetTest1', [1.1, 1.2, 1.3], ['value1', 'value2', 'value3']),
			db.sortedSetAdd('sortedSetTest2', [1, 4], ['value1', 'value4']),
			db.sortedSetAdd('sortedSetTest3', [2, 4], ['value2', 'value4']),
			db.sortedSetAdd('sortedSetTest4', [1, 1, 2, 3, 5], ['b', 'a', 'd', 'e', 'c']),
			db.sortedSetAdd('sortedSetLex', [0, 0, 0, 0], ['a', 'b', 'c', 'd']),
		]);
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
			assert.strictEqual(data.length, 2);
		});

		it('should work for special characters', async () => {
			await db.sortedSetAdd('scanzset3', [1, 2, 3, 4, 5], ['aaab{', 'bbbb', 'bbcb{', 'ddb', 'dddd']);
			const data = await db.getSortedSetScan({
				key: 'scanzset3',
				match: '*b{',
				limit: 2,
			});
			assert.strictEqual(data.length, 2);
			assert(data.includes('aaab{'));
			assert(data.includes('bbcb{'));
		});

		it('should find everything starting with string', async () => {
			await db.sortedSetAdd('scanzset4', [1, 2, 3, 4, 5], ['aaab{', 'bbbb', 'bbcb', 'ddb', 'dddd']);
			const data = await db.getSortedSetScan({
				key: 'scanzset4',
				match: 'b*',
			});
			assert.strictEqual(data.length, 2);
			assert(data.includes('bbbb'));
			assert(data.includes('bbcb'));
		});

		it('should find everything ending with string', async () => {
			await db.sortedSetAdd('scanzset5', [1, 2, 3, 4, 5, 6], ['aaab{', 'bbbb', 'bbcb', 'ddb', 'dddd', 'adb']);
			const data = await db.getSortedSetScan({
				key: 'scanzset5',
				match: '*db',
			});
			assert.strictEqual(data.length, 2);
			assert(data.includes('ddb'));
			assert(data.includes('adb'));
		});

		it('should not error with invalid input', async () => {
			const query = `-3217'
OR 1251=CAST((CHR(113)||CHR(98)||CHR(118)||CHR(98)||CHR(113))||(SELECT
(CASE WHEN (1251=1251) THEN 1 ELSE 0
END))::text||(CHR(113)||CHR(113)||CHR(118)||CHR(98)||CHR(113)) AS
NUMERIC)-- WsPn&query[cid]=-1&parentCid=0&selectedCids[]=-1&privilege=topics:read&states[]=watching&states[]=tracking&states[]=notwatching&showLinks=`;
			const match = `*${query.toLowerCase()}*`;
			const data = await db.getSortedSetScan({
				key: 'categories:name',
				match: match,
				limit: 500,
			});
			assert.strictEqual(data.length, 0);
		});
	});

	describe('sortedSetAdd()', () => {
		it('should add an element to a sorted set', async () => {
			await db.sortedSetAdd('sorted1', 1, 'value1');
			assert.strictEqual(await db.isSortedSetMember('sorted1', 'value1'), true);
		});

		it('should add two elements to a sorted set', async () => {
			await db.sortedSetAdd('sorted2', [1, 2], ['value1', 'value2']);
			assert.strictEqual(await db.isSortedSetMember('sorted2', 'value1'), true);
			assert.strictEqual(await db.isSortedSetMember('sorted2', 'value2'), true);
		});

		it('should gracefully handle adding the same element twice', async () => {
			await db.sortedSetAdd('sorted2', [1, 2], ['value1', 'value1']);
			const score = await db.sortedSetScore('sorted2', 'value1');
			assert.strictEqual(score, 2);
		});

		it('should error if score is null', async () => {
			await assert.rejects(
				db.sortedSetAdd('errorScore', null, 'value1'),
				{ message: '[[error:invalid-score, null]]' }
			);
		});

		it('should error if any score is undefined', async () => {
			await assert.rejects(
				db.sortedSetAdd('errorScore', [1, undefined], ['value1', 'value2']),
				{ message: '[[error:invalid-score, undefined]]' }
			);
		});

		it('should add null value as `null` string', async () => {
			await db.sortedSetAdd('nullValueZSet', 1, null);
			const values = await db.getSortedSetRange('nullValueZSet', 0, -1);
			assert.strictEqual(values[0], 'null');
		});
	});

	describe('sortedSetsAdd()', () => {
		it('should add an element to two sorted sets', async () => {
			await db.sortedSetsAdd(['sorted1', 'sorted2'], 3, 'value3');
			assert.strictEqual(await db.isSortedSetMember('sorted1', 'value3'), true);
			assert.strictEqual(await db.isSortedSetMember('sorted2', 'value3'), true);
		});

		it('should add an element to two sorted sets with different scores', async () => {
			await db.sortedSetsAdd(['sorted1', 'sorted2'], [4, 5], 'value4');
			const scores = await db.sortedSetsScore(['sorted1', 'sorted2'], 'value4');
			assert.deepStrictEqual(scores, [4, 5]);
		});

		it('should error if keys.length is different than scores.length', async () => {
			await assert.rejects(
				db.sortedSetsAdd(['sorted1', 'sorted2'], [4], 'value4'),
				{ message: '[[error:invalid-data]]' }
			);
		});

		it('should error if score is null', async () => {
			await assert.rejects(
				db.sortedSetsAdd(['sorted1', 'sorted2'], null, 'value1'),
				{ message: '[[error:invalid-score, null]]' }
			);
		});

		it('should error if scores has null', async () => {
			await assert.rejects(
				db.sortedSetsAdd(['sorted1', 'sorted2'], [1, null], 'dontadd'),
				{ message: '[[error:invalid-score, 1,]]' }
			);
			assert.strictEqual(await db.isSortedSetMember('sorted1', 'dontadd'), false);
			assert.strictEqual(await db.isSortedSetMember('sorted2', 'dontadd'), false);
		});
	});

	describe('sortedSetAddMulti()', () => {
		it('should add elements into  into multiple sorted sets with different scores', async () => {
			await db.sortedSetAddBulk([
				['bulk1', 1, 'item1'],
				['bulk2', 2, 'item1'],
				['bulk2', 3, 'item2'],
				['bulk3', 4, 'item3'],
			]);
			const data = await db.getSortedSetRevRangeWithScores(['bulk1', 'bulk2', 'bulk3'], 0, -1);
			assert.deepStrictEqual(data, [
				{ value: 'item3', score: 4 },
				{ value: 'item2', score: 3 },
				{ value: 'item1', score: 2 },
				{ value: 'item1', score: 1 }
			]);
		});

		it('should not error if data is undefined', async () => {
			await db.sortedSetAddBulk(undefined);
		});

		it('should error if score is null', async () => {
			await assert.rejects(
				db.sortedSetAddBulk([
					['bulk4', 0, 'dontadd'],
					['bulk5', null, 'dontadd'],
				]),
				{ message: '[[error:invalid-score, null]]' }
			);
			assert.strictEqual(await db.isSortedSetMember('bulk4', 'dontadd'), false);
			assert.strictEqual(await db.isSortedSetMember('bulk5', 'dontadd'), false);
		});
	});

	describe('getSortedSetRange()', () => {
		it('should return the lowest scored element', async () => {
			const value = await db.getSortedSetRange('sortedSetTest1', 0, 0);
			assert.deepStrictEqual(value, ['value1']);
		});

		it('should return elements sorted by score lowest to highest', async () => {
			const values = await db.getSortedSetRange('sortedSetTest1', 0, -1);
			assert.deepStrictEqual(values, ['value1', 'value2', 'value3']);
		});

		it('should return empty array if set does not exist', async () => {
			const values = await db.getSortedSetRange('doesnotexist', 0, -1);
			assert(Array.isArray(values));
			assert.strictEqual(values.length, 0);
		});

		describe('handle negative start/stop', () => {
			before(async () => {
				await db.sortedSetAdd('negatives', [1, 2, 3, 4, 5], ['1', '2', '3', '4', '5']);
			});

			it('should handle negative start/stop 1', async () => {
				const data = await db.getSortedSetRange('negatives', -2, -4);
				assert.deepStrictEqual(data, []);
			});
	
			it('should handle negative start/stop 2', async () => {
				const data = await db.getSortedSetRange('negatives', -4, -2);
				assert.deepStrictEqual(data, ['2', '3', '4']);
			});
	
			it('should handle negative start/stop 3', async () => {
				const data = await db.getSortedSetRevRange('negatives', -4, -2);
				assert.deepStrictEqual(data, ['4', '3', '2']);
			});
	
			it('should handle negative start/stop 4', async () => {
				const data = await db.getSortedSetRange('negatives', -5, -1);
				assert.deepStrictEqual(data, ['1', '2', '3', '4', '5']);
			});
	
			it('should handle negative start/stop 5', async () => {
				const data = await db.getSortedSetRange('negatives', 0, -2);
				assert.deepStrictEqual(data, ['1', '2', '3', '4']);
			});
		});

		it('should return empty array if keys is empty array', async () => {
			const data = await db.getSortedSetRange([], 0, -1);
			assert.deepStrictEqual(data, []);
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

		it('should work with big arrays (length > 100)', async function () {
			this.timeout(100000);
			const keys = [];
			for (let i = 0; i < 400; i++) {
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
			assert.strictEqual(data.length, 40000);

			data = await db.getSortedSetRange(keys, 9998, 10002);
			assert.deepStrictEqual(data, ['9998', '9999', '10000', '10001', '10002']);
		});
	});

	describe('getSortedSetRevRange()', () => {
		it('should return the highest scored element', async () => {
			const value = await db.getSortedSetRevRange('sortedSetTest1', 0, 0);
			assert.deepStrictEqual(value, ['value3']);
		});

		it('should return elements sorted by score highest to lowest', async () => {
			const values = await db.getSortedSetRevRange('sortedSetTest1', 0, -1);
			assert.deepStrictEqual(values, ['value3', 'value2', 'value1']);
		});
	});

	describe('getSortedSetRangeWithScores()', () => {
		it('should return array of elements sorted by score lowest to highest with scores', async () => {
			const values = await db.getSortedSetRangeWithScores('sortedSetTest1', 0, -1);
			assert.deepStrictEqual(values, [
				{ value: 'value1', score: 1.1 },
				{ value: 'value2', score: 1.2 },
				{ value: 'value3', score: 1.3 }
			]);
		});
	});

	describe('getSortedSetRevRangeWithScores()', () => {
		it('should return array of elements sorted by score highest to lowest with scores', async () => {
			const values = await db.getSortedSetRevRangeWithScores('sortedSetTest1', 0, -1);
			assert.deepStrictEqual(values, [
				{ value: 'value3', score: 1.3 },
				{ value: 'value2', score: 1.2 },
				{ value: 'value1', score: 1.1 }
			]);
		});
	});

	describe('getSortedSetRangeByScore()', () => {
		it('should get count elements with score between min max sorted by score lowest to highest', async () => {
			const values = await db.getSortedSetRangeByScore('sortedSetTest1', 0, -1, '-inf', 1.2);
			assert.deepStrictEqual(values, ['value1', 'value2']);
		});

		it('should return empty array if set does not exist', async () => {
			const values = await db.getSortedSetRangeByScore('doesnotexist', 0, -1, '-inf', 0);
			assert(Array.isArray(values));
			assert.strictEqual(values.length, 0);
		});

		it('should return empty array if count is 0', async () => {
			const values = await db.getSortedSetRevRangeByScore('sortedSetTest1', 0, 0, '+inf', '-inf');
			assert.deepStrictEqual(values, []);
		});

		it('should return elements from 1 to end', async () => {
			const values = await db.getSortedSetRevRangeByScore('sortedSetTest1', 1, -1, '+inf', '-inf');
			assert.deepStrictEqual(values, ['value2', 'value1']);
		});

		it('should return elements from 3 to last', async () => {
			await db.sortedSetAdd('partialZset', [1, 2, 3, 4, 5], ['value1', 'value2', 'value3', 'value4', 'value5']);
			const data = await db.getSortedSetRangeByScore('partialZset', 3, 10, '-inf', '+inf');
			assert.deepStrictEqual(data, ['value4', 'value5']);
		});

		it('should return elements if min/max are numeric strings', async () => {
			await db.sortedSetAdd('zsetstringminmax', [1, 2, 3, 4, 5], ['value1', 'value2', 'value3', 'value4', 'value5']);
			const results = await db.getSortedSetRevRangeByScore('zsetstringminmax', 0, -1, '3', '3');
			assert.deepStrictEqual(results, ['value3']);
		});
	});

	describe('getSortedSetRevRangeByScore()', () => {
		it('should get count elements with score between max min sorted by score highest to lowest', async () => {
			const values = await db.getSortedSetRevRangeByScore('sortedSetTest1', 0, -1, '+inf', 1.2);
			assert.deepStrictEqual(values, ['value3', 'value2']);
		});
	});

	describe('getSortedSetRangeByScoreWithScores()', () => {
		it('should get count elements with score between min max sorted by score lowest to highest with scores', async () => {
			const values = await db.getSortedSetRangeByScoreWithScores('sortedSetTest1', 0, -1, '-inf', 1.2);
			assert.deepStrictEqual(values, [
				{ value: 'value1', score: 1.1 },
				{ value: 'value2', score: 1.2 }
			]);
		});
	});

	describe('getSortedSetRevRangeByScoreWithScores()', () => {
		it('should get count elements with score between max min sorted by score highest to lowest', async () => {
			const values = await db.getSortedSetRevRangeByScoreWithScores('sortedSetTest1', 0, -1, '+inf', 1.2);
			assert.deepStrictEqual(values, [
				{ value: 'value3', score: 1.3 },
				{ value: 'value2', score: 1.2 }
			]);
		});

		it('should work with an array of keys', async () => {
			await db.sortedSetAddBulk([
				['byScoreWithScoresKeys1', 1, 'value1'],
				['byScoreWithScoresKeys2', 2, 'value2'],
			]);
			const data = await db.getSortedSetRevRangeByScoreWithScores(['byScoreWithScoresKeys1', 'byScoreWithScoresKeys2'], 0, -1, 5, -5);
			assert.deepStrictEqual(data, [
				{ value: 'value2', score: 2 },
				{ value: 'value1', score: 1 }
			]);
		});
	});

	describe('sortedSetCount()', () => {
		it('should return 0 for a sorted set that does not exist', async () => {
			const count = await db.sortedSetCount('doesnotexist', 0, 10);
			assert.strictEqual(count, 0);
		});

		it('should return number of elements between scores min max inclusive', async () => {
			const count = await db.sortedSetCount('sortedSetTest1', '-inf', 1.2);
			assert.strictEqual(count, 2);
		});

		it('should return number of elements between scores -inf +inf inclusive', async () => {
			const count = await db.sortedSetCount('sortedSetTest1', '-inf', '+inf');
			assert.strictEqual(count, 3);
		});
	});

	describe('sortedSetCard()', () => {
		it('should return 0 for a sorted set that does not exist', async () => {
			const count = await db.sortedSetCard('doesnotexist');
			assert.strictEqual(count, 0);
		});

		it('should return number of elements in a sorted set', async () => {
			const count = await db.sortedSetCard('sortedSetTest1');
			assert.strictEqual(count, 3);
		});
	});

	describe('sortedSetsCard()', () => {
		it('should return the number of elements in sorted sets', async () => {
			const counts = await db.sortedSetsCard(['sortedSetTest1', 'sortedSetTest2', 'doesnotexist']);
			assert.deepStrictEqual(counts, [3, 2, 0]);
		});

		it('should return empty array if keys is falsy', async () => {
			const counts = await db.sortedSetsCard(undefined);
			assert.deepStrictEqual(counts, []);
		});

		it('should return empty array if keys is empty array', async () => {
			const counts = await db.sortedSetsCard([]);
			assert.deepStrictEqual(counts, []);
		});
	});

	describe('sortedSetsCardSum()', () => {
		it('should return the total number of elements in sorted sets', async () => {
			const sum = await db.sortedSetsCardSum(['sortedSetTest1', 'sortedSetTest2', 'doesnotexist']);
			assert.strictEqual(sum, 5);
		});

		it('should return 0 if keys is falsy', async () => {
			const counts = await db.sortedSetsCardSum(undefined);
			assert.deepStrictEqual(counts, 0);
		});

		it('should return 0 if keys is empty array', async () => {
			const counts = await db.sortedSetsCardSum([]);
			assert.deepStrictEqual(counts, 0);
		});

		it('should return the total number of elements in sorted set', async () => {
			const sum = await db.sortedSetsCardSum('sortedSetTest1');
			assert.strictEqual(sum, 3);
		});

		it('should work with min/max', async () => {
			let count = await db.sortedSetsCardSum(['sortedSetTest1', 'sortedSetTest2', 'sortedSetTest3'], '-inf', 2);
			assert.strictEqual(count, 5);

			count = await db.sortedSetsCardSum(['sortedSetTest1', 'sortedSetTest2', 'sortedSetTest3'], 2, '+inf');
			assert.strictEqual(count, 3);

			count = await db.sortedSetsCardSum(['sortedSetTest1', 'sortedSetTest2', 'sortedSetTest3'], '-inf', '+inf');
			assert.strictEqual(count, 7);
		});
	});

	describe('sortedSetRank()', () => {
		it('should return falsy if sorted set does not exist', async () => {
			const rank = await db.sortedSetRank('doesnotexist', 'value1');
			assert.strictEqual(!!rank, false);
		});

		it('should return falsy if element isnt in sorted set', async () => {
			const rank = await db.sortedSetRank('sortedSetTest1', 'value5');
			assert.strictEqual(!!rank, false);
		});

		it('should return the rank of the element in the sorted set sorted by lowest to highest score', async () => {
			const rank = await db.sortedSetRank('sortedSetTest1', 'value1');
			assert.strictEqual(rank, 0);
		});

		it('should return the rank sorted by the score and then the value (a)', async () => {
			const rank = await db.sortedSetRank('sortedSetTest4', 'a');
			assert.strictEqual(rank, 0);
		});

		it('should return the rank sorted by the score and then the value (b)', async () => {
			const rank = await db.sortedSetRank('sortedSetTest4', 'b');
			assert.strictEqual(rank, 1);
		});

		it('should return the rank sorted by the score and then the value (c)', async () => {
			const rank = await db.sortedSetRank('sortedSetTest4', 'c');
			assert.strictEqual(rank, 4);
		});
	});

	describe('sortedSetRevRank()', () => {
		it('should return falsy if sorted set doesnot exist', async () => {
			const rank = await db.sortedSetRevRank('doesnotexist', 'value1');
			assert.strictEqual(!!rank, false);
		});

		it('should return falsy if element isnt in sorted set', async () => {
			const rank = await db.sortedSetRevRank('sortedSetTest1', 'value5');
			assert.strictEqual(!!rank, false);
		});

		it('should return the rank of the element in the sorted set sorted by highest to lowest score', async () => {
			const rank = await db.sortedSetRevRank('sortedSetTest1', 'value1');
			assert.strictEqual(rank, 2);
		});
	});

	describe('sortedSetsRanks()', () => {
		it('should return the ranks of values in sorted sets', async () => {
			const ranks = await db.sortedSetsRanks(['sortedSetTest1', 'sortedSetTest2'], ['value1', 'value4']);
			assert.deepStrictEqual(ranks, [0, 1]);
		});
	});

	describe('sortedSetRanks()', () => {
		it('should return the ranks of values in a sorted set', async () => {
			const ranks = await db.sortedSetRanks('sortedSetTest1', ['value2', 'value1', 'value3', 'value4']);
			assert.deepStrictEqual(ranks, [1, 0, 2, null]);
		});

		it('should return the ranks of values in a sorted set in reverse', async () => {
			const ranks = await db.sortedSetRevRanks('sortedSetTest1', ['value2', 'value1', 'value3', 'value4']);
			assert.deepStrictEqual(ranks, [1, 2, 0, null]);
		});
	});

	describe('sortedSetScore()', () => {
		it('should return falsy if sorted set does not exist', async () => {
			const score = await db.sortedSetScore('doesnotexist', 'value1');
			assert.strictEqual(!!score, false);
			assert.strictEqual(score, null);
		});

		it('should return falsy if element is not in sorted set', async () => {
			const score = await db.sortedSetScore('sortedSetTest1', 'value5');
			assert.strictEqual(!!score, false);
			assert.strictEqual(score, null);
		});

		it('should return the score of an element', async () => {
			const score = await db.sortedSetScore('sortedSetTest1', 'value2');
			assert.strictEqual(score, 1.2);
		});

		it('should not error if key is undefined', async () => {
			const score = await db.sortedSetScore(undefined, 1);
			assert.strictEqual(score, null);
		});

		it('should not error if value is undefined', async () => {
			const score = await db.sortedSetScore('sortedSetTest1', undefined);
			assert.strictEqual(score, null);
		});
	});

	describe('sortedSetsScore()', () => {
		it('should return the scores of value in sorted sets', async () => {
			const scores = await db.sortedSetsScore(['sortedSetTest1', 'sortedSetTest2', 'doesnotexist'], 'value1');
			assert.deepStrictEqual(scores, [1.1, 1, null]);
		});

		it('should return scores even if some keys are undefined', async () => {
			const scores = await db.sortedSetsScore(['sortedSetTest1', undefined, 'doesnotexist'], 'value1');
			assert.deepStrictEqual(scores, [1.1, null, null]);
		});

		it('should return empty array if keys is empty array', async () => {
			const scores = await db.sortedSetsScore([], 'value1');
			assert.deepStrictEqual(scores, []);
		});
	});

	describe('sortedSetScores()', () => {
		before(async () => {
			await db.sortedSetAdd('zeroScore', 0, 'value1');
		});

		it('should return 0 if score is 0', async () => {
			const scores = await db.sortedSetScores('zeroScore', ['value1']);
			assert.strictEqual(scores[0], 0);
		});

		it('should return the scores of value in sorted sets', async () => {
			const scores = await db.sortedSetScores('sortedSetTest1', ['value2', 'value1', 'doesnotexist']);
			assert.deepStrictEqual(scores, [1.2, 1.1, null]);
		});

		it('should return scores even if some values are undefined', async () => {
			const scores = await db.sortedSetScores('sortedSetTest1', ['value2', undefined, 'doesnotexist']);
			assert.deepStrictEqual(scores, [1.2, null, null]);
		});

		it('should return empty array if values is an empty array', async () => {
			const scores = await db.sortedSetScores('sortedSetTest1', []);
			assert.deepStrictEqual(scores, []);
		});

		it('should return scores properly', async () => {
			const scores = await db.sortedSetsScore(['zeroScore', 'sortedSetTest1', 'doesnotexist'], 'value1');
			assert.deepStrictEqual(scores, [0, 1.1, null]);
		});
	});

	describe('isSortedSetMember()', () => {
		before(async () => {
			await db.sortedSetAdd('zeroscore', 0, 'itemwithzeroscore');
		});

		it('should return false if sorted set does not exist', async () => {
			const isMember = await db.isSortedSetMember('doesnotexist', 'value1');
			assert.strictEqual(isMember, false);
		});

		it('should return false if element is not in sorted set', async () => {
			const isMember = await db.isSortedSetMember('sorted2', 'value5');
			assert.strictEqual(isMember, false);
		});

		it('should return true if element is in sorted set', async () => {
			const isMember = await db.isSortedSetMember('sortedSetTest1', 'value2');
			assert.strictEqual(isMember, true);
		});

		it('should return true if element is in sorted set with score 0', async () => {
			const isMember = await db.isSortedSetMember('zeroscore', 'itemwithzeroscore');
			assert.strictEqual(isMember, true);
		});
	});

	describe('isSortedSetMembers()', () => {
		it('should return an array of booleans indicating membership', async () => {
			const isMembers = await db.isSortedSetMembers('sortedSetTest1', ['value1', 'value2', 'value5']);
			assert.deepStrictEqual(isMembers, [true, true, false]);
		});

		it('should return true if element is in sorted set with score 0', async () => {
			const isMembers = await db.isSortedSetMembers('zeroscore', ['itemwithzeroscore']);
			assert.deepStrictEqual(isMembers, [true]);
		});
	});

	describe('isMemberOfSortedSets', () => {
		it('should return true for members false for non members', async () => {
			const isMembers = await db.isMemberOfSortedSets(['doesnotexist', 'sortedSetTest1', 'sortedSetTest2'], 'value2');
			assert.deepStrictEqual(isMembers, [false, true, false]);
		});

		it('should return empty array if keys is empty array', async () => {
			const isMembers = await db.isMemberOfSortedSets([], 'value2');
			assert.deepStrictEqual(isMembers, []);
		});
	});

	describe('getSortedSetsMembers', () => {
		it('should return members of a sorted set', async () => {
			const result = await db.getSortedSetMembers('sortedSetTest1');
			result.forEach((element) => {
				assert(['value1', 'value2', 'value3'].includes(element));
			});
		});

		it('should return members of multiple sorted sets', async () => {
			const sortedSets = await db.getSortedSetsMembers(['doesnotexist', 'sortedSetTest1']);
			assert.deepStrictEqual(sortedSets[0], []);
			sortedSets[1].forEach((element) => {
				assert(['value1', 'value2', 'value3'].includes(element));
			});
		});

		it('should return members of sorted set with scores', async () => {
			await db.sortedSetAdd('getSortedSetsMembersWithScores', [1, 2, 3], ['v1', 'v2', 'v3']);
			const d = await db.getSortedSetMembersWithScores('getSortedSetsMembersWithScores');
			assert.deepStrictEqual(d, [
				{ value: 'v1', score: 1 },
				{ value: 'v2', score: 2 },
				{ value: 'v3', score: 3 },
			]);
		});

		it('should return members of multiple sorted sets with scores', async () => {
			const d = await db.getSortedSetsMembersWithScores(['doesnotexist', 'getSortedSetsMembersWithScores']);
			assert.deepStrictEqual(d[0], []);
			assert.deepStrictEqual(d[1], [
				{ value: 'v1', score: 1 },
				{ value: 'v2', score: 2 },
				{ value: 'v3', score: 3 },
			]);
		});
	});

	describe('sortedSetUnionCard', () => {
		it('should return the number of elements in the union', async () => {
			const count = await db.sortedSetUnionCard(['sortedSetTest2', 'sortedSetTest3']);
			assert.strictEqual(count, 3);
		});
	});

	describe('getSortedSetUnion()', () => {
		it('should return an array of values from both sorted sets sorted by scores lowest to highest', async () => {
			const values = await db.getSortedSetUnion({ sets: ['sortedSetTest2', 'sortedSetTest3'], start: 0, stop: -1 });
			assert.deepStrictEqual(values, ['value1', 'value2', 'value4']);
		});

		it('should return an array of values and scores from both sorted sets sorted by scores lowest to highest', async () => {
			const data = await db.getSortedSetUnion({ sets: ['sortedSetTest2', 'sortedSetTest3'], start: 0, stop: -1, withScores: true });
			assert.deepStrictEqual(data, [
				{ value: 'value1', score: 1 },
				{ value: 'value2', score: 2 },
				{ value: 'value4', score: 8 }
			]);
		});
	});

	describe('getSortedSetRevUnion()', () => {
		it('should return an array of values from both sorted sets sorted by scores highest to lowest', async () => {
			const values = await db.getSortedSetRevUnion({ sets: ['sortedSetTest2', 'sortedSetTest3'], start: 0, stop: -1 });
			assert.deepStrictEqual(values, ['value4', 'value2', 'value1']);
		});

		it('should return empty array if sets is empty', async () => {
			const result = await db.getSortedSetRevUnion({ sets: [], start: 0, stop: -1 });
			assert.deepStrictEqual(result, []);
		});
	});

	describe('sortedSetIncrBy()', () => {
		it('should create a sorted set with a field set to 1', async () => {
			const newValue = await db.sortedSetIncrBy('sortedIncr', 1, 'field1');
			assert.strictEqual(newValue, 1);
			const score = await db.sortedSetScore('sortedIncr', 'field1');
			assert.strictEqual(score, 1);
		});

		it('should increment a field of a sorted set by 5', async () => {
			const newValue = await db.sortedSetIncrBy('sortedIncr', 5, 'field1');
			assert.strictEqual(newValue, 6);
			const score = await db.sortedSetScore('sortedIncr', 'field1');
			assert.strictEqual(score, 6);
		});

		it('should increment fields of sorted sets with a single call', async () => {
			const data = await db.sortedSetIncrByBulk([
				['sortedIncrBulk1', 1, 'value1'],
				['sortedIncrBulk2', 2, 'value2'],
				['sortedIncrBulk3', 3, 'value3'],
				['sortedIncrBulk3', 4, 'value4'],
			]);
			assert.deepStrictEqual(data, [1, 2, 3, 4]);
			assert.deepStrictEqual(
				await db.getSortedSetRangeWithScores('sortedIncrBulk1', 0, -1),
				[{ value: 'value1', score: 1 }]
			);
			assert.deepStrictEqual(
				await db.getSortedSetRangeWithScores('sortedIncrBulk2', 0, -1),
				[{ value: 'value2', score: 2 }]
			);
			assert.deepStrictEqual(
				await db.getSortedSetRangeWithScores('sortedIncrBulk3', 0, -1),
				[
					{ value: 'value3', score: 3 },
					{ value: 'value4', score: 4 },
				]
			);
		});

		it('should increment the same field', async () => {
			await db.sortedSetIncrByBulk([['sortedIncrBulk5', 5, 'value5']]);
			await db.sortedSetIncrByBulk([['sortedIncrBulk5', 5, 'value5']]);
			assert.deepStrictEqual(
				await db.getSortedSetRangeWithScores('sortedIncrBulk5', 0, -1),
				[{ value: 'value5', score: 10 }]
			);
		});
	});

	describe('sortedSetRemove()', () => {
		before(async () => {
			await db.sortedSetAdd('sorted3', [1, 2], ['value1', 'value2']);
		});

		it('should remove an element from a sorted set', async () => {
			await db.sortedSetRemove('sorted3', 'value2');
			const isMember = await db.isSortedSetMember('sorted3', 'value2');
			assert.strictEqual(isMember, false);
		});

		it('should not error if key is null', async () => {
			await db.sortedSetRemove(null, 'arbitraryValue');
		});

		it('should not error if key is empty', async () => {
			await db.sortedSetRemove([], 'arbitraryValue');
		});

		it('should not think the sorted set exists if the last element is removed', async () => {
			await db.sortedSetRemove('sorted3', 'value1');
			assert.strictEqual(await db.exists('sorted3'), false);
		});

		it('should remove multiple values from multiple keys', async () => {
			await db.sortedSetAdd('multiTest1', [1, 2, 3, 4], ['one', 'two', 'three', 'four']);
			await db.sortedSetAdd('multiTest2', [3, 4, 5, 6], ['three', 'four', 'five', 'six']);
			await db.sortedSetRemove(['multiTest1', 'multiTest2'], ['two', 'three', 'four', 'five', 'doesnt exist']);
			const members = await db.getSortedSetsMembers(['multiTest1', 'multiTest2']);
			assert.deepStrictEqual(members, [['one'], ['six']]);
		});

		it('should remove value from multiple keys', async () => {
			await db.sortedSetAdd('multiTest3', [1, 2, 3, 4], ['one', 'two', 'three', 'four']);
			await db.sortedSetAdd('multiTest4', [3, 4, 5, 6], ['three', 'four', 'five', 'six']);
			await db.sortedSetRemove(['multiTest3', 'multiTest4'], 'three');
			assert.deepStrictEqual(await db.getSortedSetRange('multiTest3', 0, -1), ['one', 'two', 'four']);
			assert.deepStrictEqual(await db.getSortedSetRange('multiTest4', 0, -1), ['four', 'five', 'six']);
		});

		it('should remove multiple values from multiple keys', async () => {
			await db.sortedSetAdd('multiTest5', [1], ['one']);
			await db.sortedSetAdd('multiTest6', [2], ['two']);
			await db.sortedSetAdd('multiTest7', [3], [333]);
			await db.sortedSetRemove(['multiTest5', 'multiTest6', 'multiTest7'], ['one', 'two', 333]);
			const members = await db.getSortedSetsMembers(['multiTest5', 'multiTest6', 'multiTest7']);
			assert.deepStrictEqual(members, [[], [], []]);
		});

		it('should not remove anything if values is empty array', async () => {
			await db.sortedSetAdd('removeNothing', [1, 2, 3], ['val1', 'val2', 'val3']);
			await db.sortedSetRemove('removeNothing', []);
			const data = await db.getSortedSetRange('removeNothing', 0, -1);
			assert.deepStrictEqual(data, ['val1', 'val2', 'val3']);
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

		it('should not remove wrong elements in bulk remove', async () => {
			await db.sortedSetAddBulk([
				['bulkRemove4', 1, 'value1'],
				['bulkRemove4', 2, 'value2'],
				['bulkRemove4', 3, 'value4'],
				['bulkRemove5', 1, 'value1'],
				['bulkRemove5', 2, 'value2'],
				['bulkRemove5', 3, 'value3'],
			]);
			await db.sortedSetRemoveBulk([
				['bulkRemove4', 'value1'],
				['bulkRemove4', 'value3'],
				['bulkRemove5', 'value1'],
				['bulkRemove5', 'value4'],
			]);
			const members = await Promise.all([
				db.getSortedSetRange('bulkRemove4', 0, -1),
				db.getSortedSetRange('bulkRemove5', 0, -1),
			]);
			assert.deepStrictEqual(members[0], ['value2', 'value4']);
			assert.deepStrictEqual(members[1], ['value2', 'value3']);
		});
	});

	describe('sortedSetsRemove()', () => {
		before(async () => {
			await Promise.all([
				db.sortedSetAdd('sorted4', [1, 2], ['value1', 'value2']),
				db.sortedSetAdd('sorted5', [1, 2], ['value1', 'value3']),
			]);
		});

		it('should remove element from multiple sorted sets', async () => {
			await db.sortedSetsRemove(['sorted4', 'sorted5'], 'value1');
			const scores = await db.sortedSetsScore(['sorted4', 'sorted5'], 'value1');
			assert.deepStrictEqual(scores, [null, null]);
		});
	});

	describe('sortedSetsRemoveRangeByScore()', () => {
		before(async () => {
			await db.sortedSetAdd('sorted6', [1, 2, 3, 4, 5], ['value1', 'value2', 'value3', 'value4', 'value5']);
		});

		it('should remove elements with scores between min max inclusive', async () => {
			assert.deepStrictEqual(
				await db.getSortedSetRange('sorted6', 0, -1),
				['value1', 'value2', 'value3', 'value4', 'value5']
			);
			await db.sortedSetsRemoveRangeByScore(['sorted6'], 4, 5);
			const values = await db.getSortedSetRange('sorted6', 0, -1);
			assert.deepStrictEqual(values, ['value1', 'value2', 'value3']);
		});

		it('should remove elements with if string score is passed in', async () => {
			await db.sortedSetAdd('sortedForRemove', [11, 22, 33], ['value1', 'value2', 'value3']);
			await db.sortedSetsRemoveRangeByScore(['sortedForRemove'], '22', '22');
			const values = await db.getSortedSetRange('sortedForRemove', 0, -1);
			assert.deepStrictEqual(values, ['value1', 'value3']);
		});
	});

	describe('getSortedSetIntersect', () => {
		before(async () => {
			await Promise.all([
				db.sortedSetAdd('interSet1', [1, 2, 3], ['value1', 'value2', 'value3']),
				db.sortedSetAdd('interSet2', [4, 5, 6], ['value2', 'value3', 'value5']),
			]);
		});

		it('should return the intersection of two sets', async () => {
			const data = await db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: -1,
			});
			assert.deepStrictEqual(data, ['value2', 'value3']);
		});

		it('should return the intersection of two sets with scores', async () => {
			const data = await db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: -1,
				withScores: true,
			});
			assert.deepStrictEqual([{ value: 'value2', score: 6 }, { value: 'value3', score: 8 }], data);
		});

		it('should return the reverse intersection of two sets', async () => {
			const data = await db.getSortedSetRevIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: 2,
			});
			assert.deepStrictEqual(['value3', 'value2'], data);
		});

		it('should return the intersection of two sets with scores aggregate MIN', async () => {
			const data = await db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: -1,
				withScores: true,
				aggregate: 'MIN',
			});
			assert.deepStrictEqual([{ value: 'value2', score: 2 }, { value: 'value3', score: 3 }], data);
		});

		it('should return the intersection of two sets with scores aggregate MAX', async () => {
			const data = await db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: -1,
				withScores: true,
				aggregate: 'MAX',
			});
			assert.deepStrictEqual([{ value: 'value2', score: 4 }, { value: 'value3', score: 5 }], data);
		});

		it('should return the intersection with scores modified by weights', async () => {
			const data = await db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet2'],
				start: 0,
				stop: -1,
				withScores: true,
				weights: [1, 0.5],
			});
			assert.deepStrictEqual([{ value: 'value2', score: 4 }, { value: 'value3', score: 5.5 }], data);
		});

		it('should return empty array if sets do not exist', async () => {
			const data = await db.getSortedSetIntersect({
				sets: ['interSet10', 'interSet12'],
				start: 0,
				stop: -1,
			});
			assert.strictEqual(data.length, 0);
		});

		it('should return empty array if one set does not exist', async () => {
			const data = await db.getSortedSetIntersect({
				sets: ['interSet1', 'interSet12'],
				start: 0,
				stop: -1,
			});
			assert.strictEqual(data.length, 0);
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
		before(async () => {
			await Promise.all([
				db.sortedSetAdd('interCard1', [0, 0, 0], ['value1', 'value2', 'value3']),
				db.sortedSetAdd('interCard2', [0, 0, 0], ['value2', 'value3', 'value4']),
				db.sortedSetAdd('interCard3', [0, 0, 0], ['value3', 'value4', 'value5']),
				db.sortedSetAdd('interCard4', [0, 0, 0], ['value4', 'value5', 'value6']),
			]);
		});

		it('should return # of elements in intersection', async () => {
			const count = await db.sortedSetIntersectCard(['interCard1', 'interCard2', 'interCard3']);
			assert.strictEqual(count, 1);
		});

		it('should return 0 if intersection is empty', async () => {
			const count = await db.sortedSetIntersectCard(['interCard1', 'interCard4']);
			assert.strictEqual(count, 0);
		});
	});

	describe('getSortedSetRangeByLex', () => {
		it('should return an array of all values', async () => {
			const data = await db.getSortedSetRangeByLex('sortedSetLex', '-', '+');
			assert.deepStrictEqual(data, ['a', 'b', 'c', 'd']);
		});

		it('should return an array with an inclusive range by default', async () => {
			const data = await db.getSortedSetRangeByLex('sortedSetLex', 'a', 'd');
			assert.deepStrictEqual(data, ['a', 'b', 'c', 'd']);
		});

		it('should return an array with an inclusive range', async () => {
			const data = await db.getSortedSetRangeByLex('sortedSetLex', '[a', '[d');
			assert.deepStrictEqual(data, ['a', 'b', 'c', 'd']);
		});

		it('should return an array with an exclusive range', async () => {
			const data = await db.getSortedSetRangeByLex('sortedSetLex', '(a', '(d');
			assert.deepStrictEqual(data, ['b', 'c']);
		});

		it('should return an array limited to the first two values', async () => {
			const data = await db.getSortedSetRangeByLex('sortedSetLex', '-', '+', 0, 2);
			assert.deepStrictEqual(data, ['a', 'b']);
		});

		it('should return correct result', async () => {
			await db.sortedSetAdd('sortedSetLexSearch', [0, 0, 0], ['baris:usakli:1', 'baris usakli:2', 'baris soner:3']);
			const query = 'baris:';
			const min = query;
			const max = query.slice(0, -1) + String.fromCharCode(query.charCodeAt(query.length - 1) + 1);
			const result = await db.getSortedSetRangeByLex('sortedSetLexSearch', min, max, 0, -1);
			assert.deepStrictEqual(result, ['baris:usakli:1']);
		});
	});

	describe('getSortedSetRevRangeByLex', () => {
		it('should return an array of all values reversed', async () => {
			const data = await db.getSortedSetRevRangeByLex('sortedSetLex', '+', '-');
			assert.deepStrictEqual(data, ['d', 'c', 'b', 'a']);
		});

		it('should return an array with an inclusive range by default reversed', async () => {
			const data = await db.getSortedSetRevRangeByLex('sortedSetLex', 'd', 'a');
			assert.deepStrictEqual(data, ['d', 'c', 'b', 'a']);
		});

		it('should return an array with an inclusive range reversed', async () => {
			const data = await db.getSortedSetRevRangeByLex('sortedSetLex', '[d', '[a');
			assert.deepStrictEqual(data, ['d', 'c', 'b', 'a']);
		});

		it('should return an array with an exclusive range reversed', async () => {
			const data = await db.getSortedSetRevRangeByLex('sortedSetLex', '(d', '(a');
			assert.deepStrictEqual(data, ['c', 'b']);
		});

		it('should return an array limited to the first two values reversed', async () => {
			const data = await db.getSortedSetRevRangeByLex('sortedSetLex', '+', '-', 0, 2);
			assert.deepStrictEqual(data, ['d', 'c']);
		});
	});

	describe('sortedSetLexCount', () => {
		it('should return the count of all values', async () => {
			const data = await db.sortedSetLexCount('sortedSetLex', '-', '+');
			assert.strictEqual(data, 4);
		});

		it('should return the count with an inclusive range by default', async () => {
			const data = await db.sortedSetLexCount('sortedSetLex', 'a', 'd');
			assert.strictEqual(data, 4);
		});

		it('should return the count with an inclusive range', async () => {
			const data = await db.sortedSetLexCount('sortedSetLex', '[a', '[d');
			assert.strictEqual(data, 4);
		});

		it('should return the count with an exclusive range', async () => {
			const data = await db.sortedSetLexCount('sortedSetLex', '(a', '(d');
			assert.strictEqual(data, 2);
		});
	});

	describe('sortedSetRemoveRangeByLex', () => {
		before(async () => {
			await db.sortedSetAdd('sortedSetLex2', [0, 0, 0, 0, 0, 0, 0], ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
		});

		it('should remove an inclusive range by default', async () => {
			await db.sortedSetRemoveRangeByLex('sortedSetLex2', 'a', 'b');
			const data = await db.getSortedSetRangeByLex('sortedSetLex2', '-', '+');
			assert.deepStrictEqual(data, ['c', 'd', 'e', 'f', 'g']);
		});

		it('should remove an inclusive range', async () => {
			await db.sortedSetRemoveRangeByLex('sortedSetLex2', '[c', '[d');
			const data = await db.getSortedSetRangeByLex('sortedSetLex2', '-', '+');
			assert.deepStrictEqual(data, ['e', 'f', 'g']);
		});

		it('should remove an exclusive range', async () => {
			await db.sortedSetRemoveRangeByLex('sortedSetLex2', '(e', '(g');
			const data = await db.getSortedSetRangeByLex('sortedSetLex2', '-', '+');
			assert.deepStrictEqual(data, ['e', 'g']);
		});

		it('should remove all values', async () => {
			await db.sortedSetRemoveRangeByLex('sortedSetLex2', '-', '+');
			const data = await db.getSortedSetRangeByLex('sortedSetLex2', '-', '+');
			assert.deepStrictEqual(data, []);
		});
	});
});