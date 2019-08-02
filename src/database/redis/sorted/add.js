'use strict';

module.exports = function (module) {
	const helpers = require('../helpers');
	const utils = require('../../../utils');

	module.sortedSetAdd = async function (key, score, value) {
		if (!key) {
			return;
		}
		if (Array.isArray(score) && Array.isArray(value)) {
			return await sortedSetAddMulti(key, score, value);
		}
		if (!utils.isNumber(score)) {
			throw new Error('[[error:invalid-score, ' + score + ']]');
		}
		await module.client.async.zadd(key, score, String(value));
	};

	async function sortedSetAddMulti(key, scores, values) {
		if (!scores.length || !values.length) {
			return;
		}

		if (scores.length !== values.length) {
			throw new Error('[[error:invalid-data]]');
		}
		for (let i = 0; i < scores.length; i += 1) {
			if (!utils.isNumber(scores[i])) {
				throw new Error('[[error:invalid-score, ' + scores[i] + ']]');
			}
		}
		var args = [key];
		for (var i = 0; i < scores.length; i += 1) {
			args.push(scores[i], String(values[i]));
		}
		await module.client.async.zadd(args);
	}

	module.sortedSetsAdd = async function (keys, scores, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		const isArrayOfScores = Array.isArray(scores);
		if (!isArrayOfScores && !utils.isNumber(scores)) {
			throw new Error('[[error:invalid-score, ' + scores + ']]');
		}

		if (isArrayOfScores && scores.length !== keys.length) {
			throw new Error('[[error:invalid-data]]');
		}

		var batch = module.client.batch();
		for (var i = 0; i < keys.length; i += 1) {
			if (keys[i]) {
				batch.zadd(keys[i], isArrayOfScores ? scores[i] : scores, String(value));
			}
		}
		await helpers.execBatch(batch);
	};

	module.sortedSetAddBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}
		var batch = module.client.batch();
		data.forEach(function (item) {
			batch.zadd(item[0], item[1], item[2]);
		});
		await helpers.execBatch(batch);
	};
};
