import assert from 'assert';
import db from '../mocks/databasemock.js'; // Assuming databasemock is ESM-compatible; add .js extension if needed

describe('List methods', () => {
	describe('listAppend()', () => {
		it('should append to a list', async () => {
			await db.listAppend('testList1', 5);
			assert.ok(true); // Assuming no return value to check; original just checks no error
		});

		it('should not add anything if key is falsy', async () => {
			await db.listAppend(null, 3);
			assert.ok(true); // Assuming no return value to check
		});

		it('should append each element to list', async () => {
			await db.listAppend('arrayListAppend', ['a', 'b', 'c']);
			let values = await db.getListRange('arrayListAppend', 0, -1);
			assert.deepStrictEqual(values, ['a', 'b', 'c']);

			await db.listAppend('arrayListAppend', ['d', 'e']);
			values = await db.getListRange('arrayListAppend', 0, -1);
			assert.deepStrictEqual(values, ['a', 'b', 'c', 'd', 'e']);
		});
	});

	describe('listPrepend()', () => {
		it('should prepend to a list', async () => {
			await db.listPrepend('testList2', 3);
			assert.ok(true); // Assuming no return value to check
		});

		it('should prepend 2 more elements to a list', async () => {
			await db.listPrepend('testList2', 2);
			await db.listPrepend('testList2', 1);
			assert.ok(true); // Assuming no return value to check
		});

		it('should not add anything if key is falsy', async () => {
			await db.listPrepend(null, 3);
			assert.ok(true); // Assuming no return value to check
		});

		it('should prepend each element to list', async () => {
			await db.listPrepend('arrayListPrepend', ['a', 'b', 'c']);
			let values = await db.getListRange('arrayListPrepend', 0, -1);
			assert.deepStrictEqual(values, ['c', 'b', 'a']);

			await db.listPrepend('arrayListPrepend', ['d', 'e']);
			values = await db.getListRange('arrayListPrepend', 0, -1);
			assert.deepStrictEqual(values, ['e', 'd', 'c', 'b', 'a']);
		});
	});

	describe('getListRange()', () => {
		before(async () => {
			await db.listAppend('testList3', 7);
			await db.listPrepend('testList3', 3);
			await db.listAppend('testList4', 5);
		});

		it('should return an empty list', async () => {
			const list = await db.getListRange('doesnotexist', 0, -1);
			assert.strictEqual(Array.isArray(list), true);
			assert.strictEqual(list.length, 0);
		});

		it('should return a list with one element', async () => {
			const list = await db.getListRange('testList4', 0, 0);
			assert.strictEqual(Array.isArray(list), true);
			assert.strictEqual(list[0], 5);
		});

		it('should return a list with 2 elements 3, 7', async () => {
			const list = await db.getListRange('testList3', 0, -1);
			assert.strictEqual(Array.isArray(list), true);
			assert.strictEqual(list.length, 2);
			assert.deepStrictEqual(list, ['3', '7']);
		});

		it('should not get anything if key is falsy', async () => {
			const data = await db.getListRange(null, 0, -1);
			assert.strictEqual(data, undefined);
		});

		it('should return list elements in reverse order', async () => {
			await db.listAppend('reverselisttest', ['one', 'two', 'three', 'four']);
			assert.deepStrictEqual(
				await db.getListRange('reverselisttest', -4, -3),
				['one', 'two']
			);
			assert.deepStrictEqual(
				await db.getListRange('reverselisttest', -2, -1),
				['three', 'four']
			);
		});
	});

	describe('listRemoveLast()', () => {
		before(async () => {
			await db.listAppend('testList7', 12);
			await db.listPrepend('testList7', 9);
		});

		it('should remove the last element of list and return it', async () => {
			const lastElement = await db.listRemoveLast('testList7');
			assert.strictEqual(lastElement, '12');
		});

		it('should not remove anything if key is falsy', async () => {
			await db.listRemoveLast(null);
			assert.ok(true); // Assuming no return value to check
		});
	});

	describe('listRemoveAll()', () => {
		before(async () => {
			await db.listAppend('testList5', 1);
			await db.listAppend('testList5', 1);
			await db.listAppend('testList5', 1);
			await db.listAppend('testList5', 2);
			await db.listAppend('testList5', 5);
		});

		it('should remove all the matching elements of list', async () => {
			await db.listRemoveAll('testList5', '1');
			const list = await db.getListRange('testList5', 0, -1);
			assert.strictEqual(Array.isArray(list), true);
			assert.strictEqual(list.length, 2);
			assert.strictEqual(list.indexOf('1'), -1);
		});

		it('should not remove anything if key is falsy', async () => {
			await db.listRemoveAll(null, 3);
			assert.ok(true); // Assuming no return value to check
		});

		it('should remove multiple elements from list', async () => {
			await db.listAppend('multiRemoveList', ['a', 'b', 'c', 'd', 'e']);
			const initial = await db.getListRange('multiRemoveList', 0, -1);
			assert.deepStrictEqual(initial, ['a', 'b', 'c', 'd', 'e']);
			await db.listRemoveAll('multiRemoveList', ['b', 'd']);
			const values = await db.getListRange('multiRemoveList', 0, -1);
			assert.deepStrictEqual(values, ['a', 'c', 'e']);
		});
	});

	describe('listTrim()', () => {
		it('should trim list to a certain range', async () => {
			const list = ['1', '2', '3', '4', '5'];
			for (const value of list) {
				await db.listAppend('testList6', value);
			}
			await db.listTrim('testList6', 0, 2);
			const trimmedList = await db.getListRange('testList6', 0, -1);
			assert.strictEqual(trimmedList.length, 3);
			assert.deepStrictEqual(trimmedList, ['1', '2', '3']);
		});

		it('should not add anything if key is falsy', async () => {
			await db.listTrim(null, 0, 3);
			assert.ok(true); // Assuming no return value to check
		});
	});

	describe('listLength', () => {
		it('should get the length of a list', async () => {
			await db.listAppend('getLengthList', 1);
			await db.listAppend('getLengthList', 2);
			const length = await db.listLength('getLengthList');
			assert.strictEqual(length, 2);
		});

		it('should return 0 if list does not have any elements', async () => {
			const length = await db.listLength('doesnotexist');
			assert.strictEqual(length, 0);
		});
	});
});