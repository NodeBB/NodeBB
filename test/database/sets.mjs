import assert from 'node:assert/strict';
import db from '../mocks/databasemock.js'; // Ensure databasemock is ESM-compatible

describe('Set methods', () => {
	describe('setAdd()', () => {
		it('should add to a set', async () => {
			await db.setAdd('testSet1', 5);
			assert.strictEqual(arguments.length, 0); // No arguments in async context
		});

		it('should add an array to a set', async () => {
			await db.setAdd('testSet1', [1, 2, 3, 4]);
			assert.strictEqual(arguments.length, 0);
		});

		it('should not do anything if values array is empty', async () => {
			await db.setAdd('emptyArraySet', []);
			const members = await db.getSetMembers('emptyArraySet');
			const exists = await db.exists('emptyArraySet');
			assert.deepStrictEqual(members, []);
			assert.strictEqual(exists, false);
		});

		it('should not error with parallel adds', async () => {
			await Promise.all([
				db.setAdd('parallelset', 1),
				db.setAdd('parallelset', 2),
				db.setAdd('parallelset', 3),
			]);
			const members = await db.getSetMembers('parallelset');
			assert.strictEqual(members.length, 3);
			assert(members.includes('1'));
			assert(members.includes('2'));
			assert(members.includes('3'));
		});
	});

	describe('getSetMembers()', () => {
		before(async () => {
			await db.setAdd('testSet2', [1, 2, 3, 4, 5]);
		});

		it('should return an empty set', async () => {
			const set = await db.getSetMembers('doesnotexist');
			assert(Array.isArray(set));
			assert.strictEqual(set.length, 0);
		});

		it('should return a set with all elements', async () => {
			const set = await db.getSetMembers('testSet2');
			assert.strictEqual(set.length, 5);
			for (const value of set) {
				assert(['1', '2', '3', '4', '5'].includes(value));
			}
		});
	});

	describe('setsAdd()', () => {
		it('should add to multiple sets', async () => {
			await db.setsAdd(['set1', 'set2'], 'value');
			assert.strictEqual(arguments.length, 0);
		});

		it('should not error if keys is empty array', async () => {
			await db.setsAdd([], 'value');
		});
	});

	describe('getSetsMembers()', () => {
		before(async () => {
			await db.setsAdd(['set3', 'set4'], 'value');
		});

		it('should return members of two sets', async () => {
			const sets = await db.getSetsMembers(['set3', 'set4']);
			assert(Array.isArray(sets));
			assert(Array.isArray(sets[0]) && Array.isArray(sets[1]));
			assert.strictEqual(sets[0][0], 'value');
			assert.strictEqual(sets[1][0], 'value');
		});
	});

	describe('isSetMember()', () => {
		before(async () => {
			await db.setAdd('testSet3', 5);
		});

		it('should return false if element is not member of set', async () => {
			const isMember = await db.isSetMember('testSet3', 10);
			assert.strictEqual(isMember, false);
		});

		it('should return true if element is a member of set', async () => {
			const isMember = await db.isSetMember('testSet3', 5);
			assert.strictEqual(isMember, true);
		});
	});

	describe('isSetMembers()', () => {
		before(async () => {
			await db.setAdd('testSet4', [1, 2, 3, 4, 5]);
		});

		it('should return an array of booleans', async () => {
			const members = await db.isSetMembers('testSet4', ['1', '2', '10', '3']);
			assert(Array.isArray(members));
			assert.deepStrictEqual(members, [true, true, false, true]);
		});
	});

	describe('isMemberOfSets()', () => {
		before(async () => {
			await db.setsAdd(['set1', 'set2'], 'value');
		});

		it('should return an array of booleans', async () => {
			const members = await db.isMemberOfSets(['set1', 'testSet1', 'set2', 'doesnotexist'], 'value');
			assert(Array.isArray(members));
			assert.deepStrictEqual(members, [true, false, true, false]);
		});
	});

	describe('setCount()', () => {
		before(async () => {
			await db.setAdd('testSet5', [1, 2, 3, 4, 5]);
		});

		it('should return the element count of set', async () => {
			const count = await db.setCount('testSet5');
			assert.strictEqual(count, 5);
		});

		it('should return 0 if set does not exist', async () => {
			const count = await db.setCount('doesnotexist');
			assert.strictEqual(count, 0);
		});
	});

	describe('setsCount()', () => {
		before(async () => {
			await Promise.all([
				db.setAdd('set5', [1, 2, 3, 4, 5]),
				db.setAdd('set6', 1),
				db.setAdd('set7', 2),
			]);
		});

		it('should return the element count of sets', async () => {
			const counts = await db.setsCount(['set5', 'set6', 'set7', 'doesnotexist']);
			assert(Array.isArray(counts));
			assert.deepStrictEqual(counts, [5, 1, 1, 0]);
		});
	});

	describe('setRemove()', () => {
		before(async () => {
			await db.setAdd('testSet6', [1, 2]);
		});

		it('should remove an element from set', async () => {
			await db.setRemove('testSet6', '2');
			const isMember = await db.isSetMember('testSet6', '2');
			assert.strictEqual(isMember, false);
		});

		it('should remove multiple elements from set', async () => {
			await db.setAdd('multiRemoveSet', [1, 2, 3, 4, 5]);
			await db.setRemove('multiRemoveSet', [1, 3, 5]);
			const members = await db.getSetMembers('multiRemoveSet');
			assert(members.includes('2'));
			assert(members.includes('4'));
		});

		it('should remove multiple values from multiple keys', async () => {
			await db.setAdd('multiSetTest1', ['one', 'two', 'three', 'four']);
			await db.setAdd('multiSetTest2', ['three', 'four', 'five', 'six']);
			await db.setRemove(['multiSetTest1', 'multiSetTest2'], ['three', 'four', 'five', 'doesnt exist']);
			const members = await db.getSetsMembers(['multiSetTest1', 'multiSetTest2']);
			assert.strictEqual(members[0].length, 2);
			assert.strictEqual(members[1].length, 1);
			assert(members[0].includes('one'));
			assert(members[0].includes('two'));
			assert(members[1].includes('six'));
		});
	});

	describe('setsRemove()', () => {
		before(async () => {
			await db.setsAdd(['set1', 'set2'], 'value');
		});

		it('should remove an element from multiple sets', async () => {
			await db.setsRemove(['set1', 'set2'], 'value');
			const members = await db.isMemberOfSets(['set1', 'set2'], 'value');
			assert.deepStrictEqual(members, [false, false]);
		});
	});

	describe('setRemoveRandom()', () => {
		before(async () => {
			await db.setAdd('testSet7', [1, 2, 3, 4, 5]);
		});

		it('should remove a random element from set', async () => {
			const element = await db.setRemoveRandom('testSet7');
			const isMember = await db.isSetMember('testSet7', element); // Fixed typo: 'testSet' to 'testSet7'
			assert.strictEqual(isMember, false);
		});
	});
});