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
		score = parseFloat(score);

		module.transaction((db) => {
			helpers.ensureLegacyObjectType(db, key, 'zset');
			const params = { key, value, score };
			db.prepare(`
			INSERT INTO "legacy_zset" ("_key", "value", "score")
			VALUES (@key, @value, @score)
			ON CONFLICT ("_key", "value")
			DO UPDATE SET "score" = @score`).run(params);
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
		values = helpers.valuesToStrings(values);
		scores = scores.map(score => parseFloat(score));

		helpers.removeDuplicateValues(values, scores);

		module.transaction((db) => {
			helpers.ensureLegacyObjectType(db, key, 'zset');

			const upsert = db.prepare(`
			INSERT INTO "legacy_zset" ("_key", "value", "score")
			VALUES (@key, @value, @score)
			ON CONFLICT ("_key", "value")
			DO UPDATE SET "score" = @score`);
			for (const [i, value] of values.entries()) {
				const score = scores[i];
				upsert.run({ key, value, score });
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

		value = helpers.valueToString(value);
		scores = isArrayOfScores ? scores.map(score => parseFloat(score)) : parseFloat(scores);

		module.transaction((db) => {
			helpers.ensureLegacyObjectsType(db, keys, 'zset');

			const upsert = db.prepare(`
			INSERT INTO "legacy_zset" ("_key", "value", "score")
			VALUES(@key, @value, @score)
			ON CONFLICT ("_key", "value")
			DO UPDATE SET "score" = @score`);
			for (const [i, key] of keys.entries()) {
				const score = isArrayOfScores ? scores[i] : scores;
				upsert.run({ key, value, score });
			}
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
			scores.push(item[1]);
			values.push(item[2]);
		});
		module.transaction((db) => {
			helpers.ensureLegacyObjectsType(db, keys, 'zset');
			const upsert = db.prepare(`
			INSERT INTO "legacy_zset" ("_key", "value", "score")
			VALUES (@key, @value, @score)
			ON CONFLICT ("_key", "value")
			DO UPDATE SET "score" = @score
			`);
			for (const [ i, key ] of keys.entries()) {
				const value = helpers.valueToString(values[i]);
				const score = scores[i];
				upsert.run({ key, value, score });
			}
		});
	};
};
