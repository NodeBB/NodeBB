'use strict';
import helpers from '../helpers';

export default  function (module) {
	const utils = require('../../../utils');

	module.sortedSetAdd = async function (key: string, score: number | string, value: Array<any>) {
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
		score = parseFloat(score as string);

		await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectType(client, key, 'zset');
			await client.query({
				name: 'sortedSetAdd',
				text: `
	INSERT INTO "legacy_zset" ("_key", "value", "score")
	VALUES ($1::TEXT, $2::TEXT, $3::NUMERIC)
	ON CONFLICT ("_key", "value")
	DO UPDATE SET "score" = $3::NUMERIC`,
				values: [key, value, score],
			});
		});
	};

	async function sortedSetAddBulk(key: string, scores: Array<any>, values: Array<any>) {
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

		await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectType(client, key, 'zset');
			await client.query({
				name: 'sortedSetAddBulk',
				text: `
INSERT INTO "legacy_zset" ("_key", "value", "score")
SELECT $1::TEXT, v, s
FROM UNNEST($2::TEXT[], $3::NUMERIC[]) vs(v, s)
ON CONFLICT ("_key", "value")
DO UPDATE SET "score" = EXCLUDED."score"`,
				values: [key, values, scores],
			});
		});
	}

	module.sortedSetsAdd = async function (keys: string[], scores: Array<any | number | string> | string | number, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		const isArrayOfScores = Array.isArray(scores);
		if ((!isArrayOfScores && !utils.isNumber(scores)) ||
			(isArrayOfScores && (scores as Array<any>).map(s => utils.isNumber(s)).includes(false))) {
			throw new Error(`[[error:invalid-score, ${scores}]]`);
		}

		if (isArrayOfScores && (scores as Array<any>).length !== keys.length) {
			throw new Error('[[error:invalid-data]]');
		}

		value = helpers.valueToString(value);
		scores = isArrayOfScores ? (scores as Array<string>).map((score: string) => parseFloat(score)) : parseFloat(scores as string);

		await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectsType(client, keys, 'zset');
			await client.query({
				name: isArrayOfScores ? 'sortedSetsAddScores' : 'sortedSetsAdd',
				text: isArrayOfScores ? `
INSERT INTO "legacy_zset" ("_key", "value", "score")
SELECT k, $2::TEXT, s
FROM UNNEST($1::TEXT[], $3::NUMERIC[]) vs(k, s)
ON CONFLICT ("_key", "value")
	DO UPDATE SET "score" = EXCLUDED."score"` : `
INSERT INTO "legacy_zset" ("_key", "value", "score")
	SELECT k, $2::TEXT, $3::NUMERIC
		FROM UNNEST($1::TEXT[]) k
			ON CONFLICT ("_key", "value")
			DO UPDATE SET "score" = $3::NUMERIC`,
				values: [keys, value, scores],
			});
		});
	};

	module.sortedSetAddBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}
		const keys : any[] = [];
		const values : any[] = [];
		const scores : any[] = [];
		data.forEach((item) => {
			if (!utils.isNumber(item[1])) {
				throw new Error(`[[error:invalid-score, ${item[1]}]]`);
			}
			keys.push(item[0]);
			scores.push(item[1]);
			values.push(item[2]);
		});
		await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectsType(client, keys, 'zset');
			await client.query({
				name: 'sortedSetAddBulk2',
				text: `
INSERT INTO "legacy_zset" ("_key", "value", "score")
SELECT k, v, s
FROM UNNEST($1::TEXT[], $2::TEXT[], $3::NUMERIC[]) vs(k, v, s)
ON CONFLICT ("_key", "value")
DO UPDATE SET "score" = EXCLUDED."score"`,
				values: [keys, values, scores],
			});
		});
	};
};
