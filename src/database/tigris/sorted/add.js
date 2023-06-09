'use strict';

module.exports = function (module) {
	const helpers = require('../helpers');
	const utils = require('../../../utils');

	module.sortedSetAdd = async function (key, score, value) {
		if (!key) {
			return;
		}
		if (Array.isArray(score) && Array.isArray(value)) {
			return await sortedSetAddBulk(key, score, value);
		}
		if (!utils.isNumber(score)) {
			throw new Error(`[[error:invalid-score, ${score}]]`);
		}
		value = helpers.valueToString(value);

		try {
			await module.upsertFilter({ _key: key, value: value });
			await module.client.getCollection('objects').updateOne({
				filter: { _key: key, value: value },
				fields: { score: parseFloat(score) },
			});
		} catch (err) {
			if (err && err.message.startsWith('E11000 duplicate key error')) {
				return await module.sortedSetAdd(key, score, value);
			}
			throw err;
		}
	};

	async function sortedSetAddBulk(key, scores, values) {
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
		values = values.map(helpers.valueToString);

		await Promise.all(
			scores.map(async (score, i) => {
				await module.upsertFilter({ _key: key, value: values[i] });
				return module.client.getCollection('objects').updateOne({
					filter: { _key: key, value: values[i] },
					fields: { score: parseFloat(score) },
				});
			}),
		);
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

		value = helpers.valueToString(value);

		await Promise.all(
			keys.map(async (key, i) => {
				await module.upsertFilter({ _key: key, value: value });
				return module.client.getCollection('objects').updateOne({
					filter: { _key: key, value: value },
					fields: { score: parseFloat(isArrayOfScores ? scores[i] : scores) },
				});
			}),
		);
	};

	module.sortedSetAddBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}
		await Promise.all(
			data.map(async (item) => {
				if (!utils.isNumber(item[1])) {
					throw new Error(`[[error:invalid-score, ${item[1]}]]`);
				}
				const filter = { _key: item[0], value: String(item[2]) };
				await module.upsertFilter(filter);
				return module.client.getCollection('objects').updateOne({
					filter: filter,
					fields: { score: parseFloat(item[1]) },
				});
			}),
		);
	};
};
