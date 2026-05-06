'use strict';

module.exports = function (module) {
	const { helpers } = module;
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
		value = String(value);
		score = parseFloat(score);

		await helpers.withTransaction(key, 'zset', async (client) => {
			await helpers.upsert(client, 'legacy_zset', {
				_key: key,
				value: value,
				score: score,
			}, ['_key', 'value'], { score: score });
		});
	}

	async function sortedSetAddBulk(key, scores, values) {
		if (!scores.length || !values.length) {
			return;
		}
		if (scores.length !== values.length) {
			throw new Error('[[error:invalid-data]]');
		}
		const invalidIdx = scores.findIndex(s => !utils.isNumber(s));
		if (invalidIdx !== -1) {
			throw new Error(`[[error:invalid-score, ${scores[invalidIdx]}]]`);
		}

		values = values.map(String);
		scores = scores.map(parseFloat);

		await helpers.withTransaction(key, 'zset', async (client) => {
			let rows = values.map((value, i) => ({
				_key: key,
				value: value,
				score: scores[i],
			}));
			// Deduplicate to avoid "ON CONFLICT DO UPDATE cannot affect row a second time" error
			rows = helpers.deduplicateRows(rows, ['_key', 'value']);
			await helpers.upsertMultiple(client, 'legacy_zset', rows, ['_key', 'value'], ['score']);
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

		value = String(value);
		scores = isArrayOfScores ? scores.map(s => parseFloat(s)) : parseFloat(scores);

		await helpers.withTransactionKeys(keys, 'zset', async (client) => {
			const rows = keys.map((key, i) => ({
				_key: key,
				value: value,
				score: isArrayOfScores ? scores[i] : scores,
			}));
			await helpers.upsertMultiple(client, 'legacy_zset', rows, ['_key', 'value'], ['score']);
		});
	};

	module.sortedSetAddBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}

		// Validate all scores first
		const invalidItem = data.find(([, score]) => !utils.isNumber(score));
		if (invalidItem) {
			throw new Error(`[[error:invalid-score, ${invalidItem[1]}]]`);
		}

		await helpers.withTransaction(null, null, async (client) => {
			// Ensure all keys have the right type
			const uniqueKeys = [...new Set(data.map(([key]) => key))];
			await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'zset');

			// Build all rows for batch upsert and deduplicate
			const rows = helpers.deduplicateRows(
				data.map(([key, score, value]) => ({
					_key: key,
					value: String(value),
					score: parseFloat(score),
				})),
				['_key', 'value']
			);
			await helpers.upsertMultiple(client, 'legacy_zset', rows, ['_key', 'value'], ['score']);
		});
	};
};