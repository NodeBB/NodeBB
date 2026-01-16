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
		if (!Array.isArray(score) && !Array.isArray(value)) {
			return await sortedSetAddSingle(key, score, value);
		}
		throw new Error('[[error:invalid-data]]');
	};

	async function sortedSetAddSingle(key, score, value) {
		const {dialect} = module;
		value = helpers.valueToString(value);
		score = parseFloat(score);

		await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectType(client, key, 'zset', dialect);

			await helpers.upsert(client, 'legacy_zset', {
				_key: key,
				value: value,
				score: score,
			}, ['_key', 'value'], { score: score }, dialect);
		});
	}

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

		const {dialect} = module;
		values = values.map(helpers.valueToString);
		scores = scores.map(s => parseFloat(s));

		await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectType(client, key, 'zset', dialect);

			for (let i = 0; i < values.length; i++) {
				await helpers.upsert(client, 'legacy_zset', {
					_key: key,
					value: values[i],
					score: scores[i],
				}, ['_key', 'value'], { score: scores[i] }, dialect);
			}
		});
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

		const {dialect} = module;
		value = helpers.valueToString(value);
		scores = isArrayOfScores ? scores.map(s => parseFloat(s)) : parseFloat(scores);

		await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectsType(client, keys, 'zset', dialect);

			for (let i = 0; i < keys.length; i++) {
				const key = keys[i];
				const score = isArrayOfScores ? scores[i] : scores;

				await helpers.upsert(client, 'legacy_zset', {
					_key: key,
					value: value,
					score: score,
				}, ['_key', 'value'], { score: score }, dialect);
			}
		});
	};

	module.sortedSetAddBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}

		// Validate all scores first
		for (const item of data) {
			if (!utils.isNumber(item[1])) {
				throw new Error(`[[error:invalid-score, ${item[1]}]]`);
			}
		}

		const {dialect} = module;

		await module.transaction(async (client) => {
			for (const item of data) {
				const [key, score, value] = item;
				const strValue = helpers.valueToString(value);
				const numScore = parseFloat(score);

				await helpers.ensureLegacyObjectType(client, key, 'zset', dialect);

				await helpers.upsert(client, 'legacy_zset', {
					_key: key,
					value: strValue,
					score: numScore,
				}, ['_key', 'value'], { score: numScore }, dialect);
			}
		});
	};
};