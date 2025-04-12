'use strict';

/**
 * @typedef {import('../../../../types/database').MySQLDatabase} MySQLDatabase
 */

/**
 * 
 * @param {MySQLDatabase} module 
 */
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
		score = parseFloat(score);

		await module.transaction(async (poolConnection) => {
			await helpers.ensureLegacyObjectType(poolConnection, key, 'zset');
			await poolConnection.query({
				sql: `
					INSERT INTO legacy_zset (_key, value, score)
					VALUES (?, ?, ?)
					ON DUPLICATE KEY UPDATE score = VALUES(score)
				`,
				values: [key, value, score],
			});
		});
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
		scores = scores.map(score => parseFloat(score));

		helpers.removeDuplicateValues(values, scores);

		await module.transaction(async (poolConnection) => {
			await helpers.ensureLegacyObjectType(poolConnection, key, 'zset');
			const placeholders = values.map(() => '(?, ?, ?)').join(', ');
			const sql = `
				INSERT INTO legacy_zset (_key, value, score)
				VALUES ${placeholders}
				ON DUPLICATE KEY UPDATE score = VALUES(score)
			`;
			const flatValues = [];
			for (let i = 0; i < values.length; i++) {
				flatValues.push(key, values[i], scores[i]);
			}
			await poolConnection.query({
				sql,
				values: flatValues,
			});
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
		scores = isArrayOfScores ? scores.map(score => parseFloat(score)) : parseFloat(scores);

		await module.transaction(async (poolConnection) => {
			await helpers.ensureLegacyObjectsType(poolConnection, keys, 'zset');
			const placeholders = isArrayOfScores
				? keys.map(() => '(?, ?, ?)').join(', ')
				: keys.map(() => '(?, ?, ?)').join(', ');
			const sql = `
				INSERT INTO legacy_zset (_key, value, score)
				VALUES ${placeholders}
				ON DUPLICATE KEY UPDATE score = VALUES(score)
			`;
			const flatValues = [];
			if (isArrayOfScores) {
				for (let i = 0; i < keys.length; i++) {
					flatValues.push(keys[i], value, scores[i]);
				}
			} else {
				for (let i = 0; i < keys.length; i++) {
					flatValues.push(keys[i], value, scores);
				}
			}
			await poolConnection.query({
				sql,
				values: flatValues,
			});
		});
	};

	module.sortedSetAddBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}
		const keys = [];
		const values = [];
		const scores = [];
		data.forEach((item) => {
			if (!utils.isNumber(item[1])) {
				throw new Error(`[[error:invalid-score, ${item[1]}]]`);
			}
			keys.push(item[0]);
			scores.push(parseFloat(item[1]));
			values.push(helpers.valueToString(item[2]));
		});

		await module.transaction(async (poolConnection) => {
			await helpers.ensureLegacyObjectsType(poolConnection, keys, 'zset');
			const placeholders = keys.map(() => '(?, ?, ?)').join(', ');
			const sql = `
				INSERT INTO legacy_zset (_key, value, score)
				VALUES ${placeholders}
				ON DUPLICATE KEY UPDATE score = VALUES(score)
			`;
			const flatValues = [];
			for (let i = 0; i < keys.length; i++) {
				flatValues.push(keys[i], values[i], scores[i]);
			}
			await poolConnection.query({
				sql,
				values: flatValues,
			});
		});
	};
};