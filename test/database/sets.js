'use strict';


var	async = require('async');
var assert = require('assert');
var db = require('../mocks/databasemock');

describe('Set methods', function () {
	describe('setAdd()', function () {
		it('should add to a set', function (done) {
			db.setAdd('testSet1', 5, function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});

		it('should add an array to a set', function (done) {
			db.setAdd('testSet1', [1, 2, 3, 4], function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});
	});

	describe('getSetMembers()', function () {
		before(function (done) {
			db.setAdd('testSet2', [1, 2, 3, 4, 5], done);
		});

		it('should return an empty set', function (done) {
			db.getSetMembers('doesnotexist', function (err, set) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(set), true);
				assert.equal(set.length, 0);
				done();
			});
		});

		it('should return a set with all elements', function (done) {
			db.getSetMembers('testSet2', function (err, set) {
				assert.equal(err, null);
				assert.equal(set.length, 5);
				set.forEach(function (value) {
					assert.notEqual(['1', '2', '3', '4', '5'].indexOf(value), -1);
				});

				done();
			});
		});
	});

	describe('setsAdd()', function () {
		it('should add to multiple sets', function (done) {
			db.setsAdd(['set1', 'set2'], 'value', function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				done();
			});
		});

		it('should not error if keys is empty array', function (done) {
			db.setsAdd([], 'value', function (err) {
				assert.ifError(err);
				done();
			});
		});
	});

	describe('getSetsMembers()', function () {
		before(function (done) {
			db.setsAdd(['set3', 'set4'], 'value', done);
		});

		it('should return members of two sets', function (done) {
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

	describe('isSetMember()', function () {
		before(function (done) {
			db.setAdd('testSet3', 5, done);
		});

		it('should return false if element is not member of set', function (done) {
			db.isSetMember('testSet3', 10, function (err, isMember) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(isMember, false);
				done();
			});
		});

		it('should return true if element is a member of set', function (done) {
			db.isSetMember('testSet3', 5, function (err, isMember) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(isMember, true);
				done();
			});
		});
	});

	describe('isSetMembers()', function () {
		before(function (done) {
			db.setAdd('testSet4', [1, 2, 3, 4, 5], done);
		});

		it('should return an array of booleans', function (done) {
			db.isSetMembers('testSet4', ['1', '2', '10', '3'], function (err, members) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(members), true);
				assert.deepEqual(members, [true, true, false, true]);
				done();
			});
		});
	});

	describe('isMemberOfSets()', function () {
		before(function (done) {
			db.setsAdd(['set1', 'set2'], 'value', done);
		});

		it('should return an array of booleans', function (done) {
			db.isMemberOfSets(['set1', 'testSet1', 'set2', 'doesnotexist'], 'value', function (err, members) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(members), true);
				assert.deepEqual(members, [true, false, true, false]);
				done();
			});
		});
	});

	describe('setCount()', function () {
		before(function (done) {
			db.setAdd('testSet5', [1, 2, 3, 4, 5], done);
		});

		it('should return the element count of set', function (done) {
			db.setCount('testSet5', function (err, count) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.strictEqual(count, 5);
				done();
			});
		});

		it('should return 0 if set does not exist', function (done) {
			db.setCount('doesnotexist', function (err, count) {
				assert.ifError(err);
				assert.strictEqual(count, 0);
				done();
			});
		});
	});

	describe('setsCount()', function () {
		before(function (done) {
			async.parallel([
				async.apply(db.setAdd, 'set5', [1, 2, 3, 4, 5]),
				async.apply(db.setAdd, 'set6', 1),
				async.apply(db.setAdd, 'set7', 2),
			], done);
		});

		it('should return the element count of sets', function (done) {
			db.setsCount(['set5', 'set6', 'set7', 'doesnotexist'], function (err, counts) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);
				assert.equal(Array.isArray(counts), true);
				assert.deepEqual(counts, [5, 1, 1, 0]);
				done();
			});
		});
	});

	describe('setRemove()', function () {
		before(function (done) {
			db.setAdd('testSet6', [1, 2], done);
		});

		it('should remove a element from set', function (done) {
			db.setRemove('testSet6', '2', function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);

				db.isSetMember('testSet6', '2', function (err, isMember) {
					assert.equal(err, null);
					assert.equal(isMember, false);
					done();
				});
			});
		});

		it('should remove multiple elements from set', function (done) {
			db.setAdd('multiRemoveSet', [1, 2, 3, 4, 5], function (err) {
				assert.ifError(err);
				db.setRemove('multiRemoveSet', [1, 3, 5], function (err) {
					assert.ifError(err);
					db.getSetMembers('multiRemoveSet', function (err, members) {
						assert.ifError(err);
						assert(members.includes('2'));
						assert(members.includes('4'));
						done();
					});
				});
			});
		});

		it('should remove multiple values from multiple keys', function (done) {
			db.setAdd('multiSetTest1', ['one', 'two', 'three', 'four'], function (err) {
				assert.ifError(err);
				db.setAdd('multiSetTest2', ['three', 'four', 'five', 'six'], function (err) {
					assert.ifError(err);
					db.setRemove(['multiSetTest1', 'multiSetTest2'], ['three', 'four', 'five', 'doesnt exist'], function (err) {
						assert.ifError(err);
						db.getSetsMembers(['multiSetTest1', 'multiSetTest2'], function (err, members) {
							assert.ifError(err);
							assert.equal(members[0].length, 2);
							assert.equal(members[1].length, 1);
							assert(members[0].includes('one'));
							assert(members[0].includes('two'));
							assert(members[1].includes('six'));
							done();
						});
					});
				});
			});
		});
	});

	describe('setsRemove()', function () {
		before(function (done) {
			db.setsAdd(['set1', 'set2'], 'value', done);
		});

		it('should remove a element from multiple sets', function (done) {
			db.setsRemove(['set1', 'set2'], 'value', function (err) {
				assert.equal(err, null);
				assert.equal(arguments.length, 1);
				db.isMemberOfSets(['set1', 'set2'], 'value', function (err, members) {
					assert.equal(err, null);
					assert.deepEqual(members, [false, false]);
					done();
				});
			});
		});
	});

	describe('setRemoveRandom()', function () {
		before(function (done) {
			db.setAdd('testSet7', [1, 2, 3, 4, 5], done);
		});

		it('should remove a random element from set', function (done) {
			db.setRemoveRandom('testSet7', function (err, element) {
				assert.equal(err, null);
				assert.equal(arguments.length, 2);

				db.isSetMember('testSet', element, function (err, ismember) {
					assert.equal(err, null);
					assert.equal(ismember, false);
					done();
				});
			});
		});
	});
});
