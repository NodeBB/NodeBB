'use strict';


const async = require('async');
const assert = require('assert');
const db = require('../mocks/databasemock');

describe('Set methods', () => {
	describe('setAdd()', () => {
		it('should add to a set', (done) => {
			db.setAdd('testSet1', 5, function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});

		it('should add an array to a set', (done) => {
			db.setAdd('testSet1', [1, 2, 3, 4], function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});

		it('should not do anything if values array is empty', async () => {
			await db.setAdd('emptyArraySet', []);
			const members = await db.getSetMembers('emptyArraySet');
			const exists = await db.exists('emptyArraySet');
			assert.deepStrictEqual(members, []);
			assert(!exists);
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
		before((done) => {
			db.setAdd('testSet2', [1, 2, 3, 4, 5], done);
		});

		it('should return an empty set', (done) => {
			db.getSetMembers('doesnotexist', function (err, set) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(set), true);
				assert.equal(set.length, 0);
				done();
			});
		});

		it('should return a set with all elements', (done) => {
			db.getSetMembers('testSet2', (err, set) => {
				assert.equal(err, null);
				assert.equal(set.length, 5);
				set.forEach((value) => {
					assert.notEqual(['1', '2', '3', '4', '5'].indexOf(value), -1);
				});

				done();
			});
		});
	});

	describe('setsAdd()', () => {
		it('should add to multiple sets', (done) => {
			db.setsAdd(['set1', 'set2'], 'value', function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});

		it('should not error if keys is empty array', (done) => {
			db.setsAdd([], 'value', (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should add the values to each set', async () => {
			await db.setsAdd(['saddarray1', 'saddarray2', 'saddarray3'], ['v1', 'v2', 'v3']);
			const data = await db.getSetsMembers(['saddarray1', 'saddarray2', 'saddarray3']);
			data.forEach(members => members.sort());
			assert.deepStrictEqual(data, [
				['v1', 'v2', 'v3'],
				['v1', 'v2', 'v3'],
				['v1', 'v2', 'v3'],
			]);
		});
	});

	describe('setAddBulk()', () => {
		it('should add multiple key-member pairs', async () => {
			await db.setAddBulk([
				['bulkSet1', 'value1'],
				['bulkSet2', 'value2'],
			]);
			let data = await db.getSetMembers('bulkSet1');
			assert.deepStrictEqual(data, ['value1']);
			data = await db.getSetMembers('bulkSet2');
			assert.deepStrictEqual(data, ['value2']);
			await db.setAddBulk([
				['bulkSet1', 'value1'],
				['bulkSet1', 'value3'],
			]);
			data = await db.getSetMembers('bulkSet1');
			assert.deepStrictEqual(data.sort(), ['value1', 'value3']);
		});
	});

	describe('getSetsMembers()', () => {
		before((done) => {
			db.setsAdd(['set3', 'set4'], 'value', done);
		});

		it('should return members of two sets', (done) => {
			db.getSetsMembers(['set3', 'set4'], function (err, sets) {
				assert.equal(err, null);
				assert.equal(Array.isArray(sets), true);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(sets[0]) && Array.isArray(sets[1]), true);
				assert.strictEqual(sets[0][0], 'value');
				assert.strictEqual(sets[1][0], 'value');
				done();
			});
		});
	});

	describe('isSetMember()', () => {
		before((done) => {
			db.setAdd('testSet3', 5, done);
		});

		it('should return false if element is not member of set', (done) => {
			db.isSetMember('testSet3', 10, function (err, isMember) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(isMember, false);
				done();
			});
		});

		it('should return true if element is a member of set', (done) => {
			db.isSetMember('testSet3', 5, function (err, isMember) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(isMember, true);
				done();
			});
		});
	});

	describe('isSetMembers()', () => {
		before((done) => {
			db.setAdd('testSet4', [1, 2, 3, 4, 5], done);
		});

		it('should return an array of booleans', (done) => {
			db.isSetMembers('testSet4', ['1', '2', '10', '3'], function (err, members) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(members), true);
				assert.deepEqual(members, [true, true, false, true]);
				done();
			});
		});
	});

	describe('isMemberOfSets()', () => {
		before((done) => {
			db.setsAdd(['set1', 'set2'], 'value', done);
		});

		it('should return an array of booleans', (done) => {
			db.isMemberOfSets(['set1', 'testSet1', 'set2', 'doesnotexist'], 'value', function (err, members) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(members), true);
				assert.deepEqual(members, [true, false, true, false]);
				done();
			});
		});
	});

	describe('setCount()', () => {
		before((done) => {
			db.setAdd('testSet5', [1, 2, 3, 4, 5], done);
		});

		it('should return the element count of set', (done) => {
			db.setCount('testSet5', function (err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.strictEqual(count, 5);
				done();
			});
		});

		it('should return 0 if set does not exist', (done) => {
			db.setCount('doesnotexist', (err, count) => {
				assert.ifError(err);
				assert.strictEqual(count, 0);
				done();
			});
		});
	});

	describe('setsCount()', () => {
		before((done) => {
			async.parallel([
				async.apply(db.setAdd, 'set5', [1, 2, 3, 4, 5]),
				async.apply(db.setAdd, 'set6', 1),
				async.apply(db.setAdd, 'set7', 2),
			], done);
		});

		it('should return the element count of sets', (done) => {
			db.setsCount(['set5', 'set6', 'set7', 'doesnotexist'], function (err, counts) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(counts), true);
				assert.deepEqual(counts, [5, 1, 1, 0]);
				done();
			});
		});
	});

	describe('setRemove()', () => {
		it('should remove an element from set', async () => {
			await db.setAdd('testSet6', [1, 2]);
			await db.setRemove('testSet6', '2');

			const isMember = await db.isSetMember('testSet6', '2');
			assert.equal(isMember, false);
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
			assert.equal(members[0].length, 2);
			assert.equal(members[1].length, 1);
			assert(members[0].includes('one'));
			assert(members[0].includes('two'));
			assert(members[1].includes('six'));
		});

		it('should remove set if all elements are removed', async () => {
			await db.setAdd('toBeDeletedSet', ['a', 'b']);
			await db.setRemove('toBeDeletedSet', ['a', 'b']);

			const exists = await db.exists('toBeDeletedSet');
			assert.equal(exists, false);
		});
	});

	describe('setsRemove()', () => {
		before((done) => {
			db.setsAdd(['set1', 'set2'], 'value', done);
		});

		it('should remove a element from multiple sets', (done) => {
			db.setsRemove(['set1', 'set2'], 'value', function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				db.isMemberOfSets(['set1', 'set2'], 'value', (err, members) => {
					assert.equal(err, null);
					assert.deepEqual(members, [false, false]);
					done();
				});
			});
		});
	});

	describe('setRemoveRandom()', () => {
		before((done) => {
			db.setAdd('testSet7', [1, 2, 3, 4, 5], done);
		});

		it('should remove a random element from set', (done) => {
			db.setRemoveRandom('testSet7', function (err, element) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);

				db.isSetMember('testSet', element, (err, ismember) => {
					assert.equal(err, null);
					assert.equal(ismember, false);
					done();
				});
			});
		});
	});
});
