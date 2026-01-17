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
		value = helpers.valueToString(value);
		score = parseFloat(score);

		await helpers.withTransaction(module, key, 'zset', async (client, dialect) => {
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

		values = values.map(helpers.valueToString);
		scores = scores.map(s => parseFloat(s));

		await helpers.withTransaction(module, key, 'zset', async (client, dialect) => {
			const rows = values.map((value, i) => ({
				_key: key,
				value: value,
				score: scores[i],
			}));
			await helpers.upsertMultiple(client, 'legacy_zset', rows, ['_key', 'value'], ['score'], dialect);
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

		value = helpers.valueToString(value);
		scores = isArrayOfScores ? scores.map(s => parseFloat(s)) : parseFloat(scores);

		await helpers.withTransactionKeys(module, keys, 'zset', async (client, dialect) => {
			const rows = keys.map((key, i) => ({
				_key: key,
				value: value,
				score: isArrayOfScores ? scores[i] : scores,
			}));
			await helpers.upsertMultiple(client, 'legacy_zset', rows, ['_key', 'value'], ['score'], dialect);
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

		await helpers.withTransaction(module, null, null, async (client, dialect) => {
			// Ensure all keys have the right type
			const uniqueKeys = [...new Set(data.map(item => item[0]))];
			await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'zset', dialect);

			// Build all rows for batch upsert
			const rows = data.map(item => ({
				_key: item[0],
				value: helpers.valueToString(item[2]),
				score: parseFloat(item[1]),
			}));

			await helpers.upsertMultiple(client, 'legacy_zset', rows, ['_key', 'value'], ['score'], dialect);
		});
	};
};