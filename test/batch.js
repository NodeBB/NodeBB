'use strict';

var async = require('async');
var assert = require('assert');

var db = require('./mocks/databasemock');

var batch = require('../src/batch');

describe('batch', () => {
	const scores = [];
	const values = [];
	before((done) => {
		for (let i = 0; i < 100; i++) {
			scores.push(i);
			values.push(`val${i}`);
		}
		db.sortedSetAdd('processMe', scores, values, done);
	});

	it('should process sorted set with callbacks', (done) => {
		let total = 0;
		batch.processSortedSet('processMe', (items, next) => {
			items.forEach((item) => {
				total += item.score;
			});

			setImmediate(next);
		}, {
			withScores: true,
			interval: 50,
			batch: 10,
		}, (err) => {
			assert.ifError(err);
			assert.strictEqual(total, 4950);
			done();
		});
	});

	it('should process sorted set with callbacks', (done) => {
		let total = 0;
		batch.processSortedSet('processMe', (values, next) => {
			values.forEach((val) => {
				total += val.length;
			});

			setImmediate(next);
		}, (err) => {
			assert.ifError(err);
			assert.strictEqual(total, 490);
			done();
		});
	});

	it('should process sorted set with async/await', async () => {
		let total = 0;
		await batch.processSortedSet('processMe', (values, next) => {
			values.forEach((val) => {
				total += val.length;
			});

			setImmediate(next);
		}, {});

		assert.strictEqual(total, 490);
	});

	it('should process sorted set with async/await', async () => {
		let total = 0;
		await batch.processSortedSet('processMe', async (values) => {
			values.forEach((val) => {
				total += val.length;
			});
			await db.getObject('doesnotexist');
		}, {});

		assert.strictEqual(total, 490);
	});

	it('should process array with callbacks', (done) => {
		let total = 0;
		batch.processArray(scores, (nums, next) => {
			nums.forEach((n) => {
				total += n;
			});

			setImmediate(next);
		}, {
			withScores: true,
			interval: 50,
			batch: 10,
		}, (err) => {
			assert.ifError(err);
			assert.strictEqual(total, 4950);
			done();
		});
	});

	it('should process array with async/await', async () => {
		let total = 0;
		await batch.processArray(scores, (nums, next) => {
			nums.forEach((n) => {
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
