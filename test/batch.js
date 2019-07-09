'use strict';

var async = require('async');
var assert = require('assert');

var db = require('./mocks/databasemock');

var batch = require('../src/batch');

describe('batch', function () {
	const scores = [];
	const values = [];
	before(function (done) {
		for (let i = 0; i < 100; i++) {
			scores.push(i);
			values.push('val' + i);
		}
		db.sortedSetAdd('processMe', scores, values, done);
	});

	it('should process sorted set with callbacks', function (done) {
		let total = 0;
		batch.processSortedSet('processMe', function (items, next) {
			items.forEach(function (item) {
				total += item.score;
			});

			setImmediate(next);
		}, {
			withScores: true,
			interval: 50,
			batch: 10,
		}, function (err) {
			assert.ifError(err);
			assert.strictEqual(total, 4950);
			done();
		});
	});

	it('should process sorted set with callbacks', function (done) {
		let total = 0;
		batch.processSortedSet('processMe', function (values, next) {
			values.forEach(function (val) {
				total += val.length;
			});

			setImmediate(next);
		}, function (err) {
			assert.ifError(err);
			assert.strictEqual(total, 490);
			done();
		});
	});

	it('should process sorted set with async/await', async function () {
		let total = 0;
		await batch.processSortedSet('processMe', function (values, next) {
			values.forEach(function (val) {
				total += val.length;
			});

			setImmediate(next);
		}, {});

		assert.strictEqual(total, 490);
	});

	it('should process sorted set with async/await', async function () {
		let total = 0;
		await batch.processSortedSet('processMe', async function (values) {
			values.forEach(function (val) {
				total += val.length;
			});
			await db.getObject('doesnotexist');
		}, {});

		assert.strictEqual(total, 490);
	});

	it('should process array with callbacks', function (done) {
		let total = 0;
		batch.processArray(scores, function (nums, next) {
			nums.forEach(function (n) {
				total += n;
			});

			setImmediate(next);
		}, {
			withScores: true,
			interval: 50,
			batch: 10,
		}, function (err) {
			assert.ifError(err);
			assert.strictEqual(total, 4950);
			done();
		});
	});

	it('should process array with async/await', async function () {
		let total = 0;
		await batch.processArray(scores, function (nums, next) {
			nums.forEach(function (n) {
				total += n;
			});

			setImmediate(next);
		}, {
			withScores: true,
			interval: 50,
			batch: 10,
		});

		assert.strictEqual(total, 4950);
	});
});
