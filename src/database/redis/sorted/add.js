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
			throw new Error(`[[error:invalid-score, ${score}]]`);
		}
		await module.client.zadd(key, score, String(value));
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
				throw new Error(`[[error:invalid-score, ${scores[i]}]]`);
			}
		}
		const args = [key];
		for (let i = 0; i < scores.length; i += 1) {
			args.push(scores[i], String(values[i]));
		}
		await module.client.zadd(args);
	}

	module.sortedSetsAdd = async function (keys, scores, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		const isArrayOfScores = Array.isArray(scores);
		if ((!isArrayOfScores && !utils.isNumber(scores)) ||
			(isArrayOfScores && scores.map(s => utils.isNumber(s)).includes(false))) {
			throw new Error(`[[error:invalid-score, ${scores}]]`);
		}

		if (isArrayOfScores && scores.length !== keys.length) {
			throw new Error('[[error:invalid-data]]');
		}

		const batch = module.client.batch();
		for (let i = 0; i < keys.length; i += 1) {
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
		const batch = module.client.batch();
		data.forEach((item) => {
			if (!utils.isNumber(item[1])) {
				throw new Error(`[[error:invalid-score, ${item[1]}]]`);
			}
			batch.zadd(item[0], item[1], item[2]);
		});
		await helpers.execBatch(batch);
	};
};
