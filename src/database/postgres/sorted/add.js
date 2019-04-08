'use strict';

var async = require('async');

module.exports = function (db, module) {
	var helpers = module.helpers.postgres;
	var utils = require('../../../utils');

	module.sortedSetAdd = function (key, score, value, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		if (Array.isArray(score) && Array.isArray(value)) {
			return sortedSetAddBulk(key, score, value, callback);
		}
		if (!utils.isNumber(score)) {
			return setImmediate(callback, new Error('[[error:invalid-score, ' + score + ']]'));
		}
		value = helpers.valueToString(value);
		score = parseFloat(score);

		module.transaction(function (tx, done) {
			var query = tx.client.query.bind(tx.client);

			async.series([
				async.apply(helpers.ensureLegacyObjectType, tx.client, key, 'zset'),
				async.apply(query, {
					name: 'sortedSetAdd',
					text: `
INSERT INTO "legacy_zset" ("_key", "value", "score")
VALUES ($1::TEXT, $2::TEXT, $3::NUMERIC)
    ON CONFLICT ("_key", "value")
    DO UPDATE SET "score" = $3::NUMERIC`,
					values: [key, value, score],
				}),
			], function (err) {
				done(err);
			});
		}, callback);
	};

	function sortedSetAddBulk(key, scores, values, callback) {
		if (!scores.length || !values.length) {
			return callback();
		}
		if (scores.length !== values.length) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		for (let i = 0; i < scores.length; i += 1) {
			if (!utils.isNumber(scores[i])) {
				return setImmediate(callback, new Error('[[error:invalid-score, ' + scores[i] + ']]'));
			}
		}
		values = values.map(helpers.valueToString);
		scores = scores.map(function (score) {
			return parseFloat(score);
		});

		helpers.removeDuplicateValues(values, scores);

		module.transaction(function (tx, done) {
			var query = tx.client.query.bind(tx.client);

			async.series([
				async.apply(helpers.ensureLegacyObjectType, tx.client, key, 'zset'),
				async.apply(query, {
					name: 'sortedSetAddBulk',
					text: `
INSERT INTO "legacy_zset" ("_key", "value", "score")
SELECT $1::TEXT, v, s
  FROM UNNEST($2::TEXT[], $3::NUMERIC[]) vs(v, s)
    ON CONFLICT ("_key", "value")
    DO UPDATE SET "score" = EXCLUDED."score"`,
					values: [key, values, scores],
				}),
			], function (err) {
				done(err);
			});
		}, callback);
	}

	module.sortedSetsAdd = function (keys, score, value, callback) {
		callback = callback || helpers.noop;

		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}
		if (!utils.isNumber(score)) {
			return setImmediate(callback, new Error('[[error:invalid-score, ' + score + ']]'));
		}
		value = helpers.valueToString(value);
		score = parseFloat(score);

		module.transaction(function (tx, done) {
			var query = tx.client.query.bind(tx.client);

			async.series([
				async.apply(helpers.ensureLegacyObjectsType, tx.client, keys, 'zset'),
				async.apply(query, {
					name: 'sortedSetsAdd',
					text: `
INSERT INTO "legacy_zset" ("_key", "value", "score")
SELECT k, $2::TEXT, $3::NUMERIC
  FROM UNNEST($1::TEXT[]) k
    ON CONFLICT ("_key", "value")
    DO UPDATE SET "score" = $3::NUMERIC`,
					values: [keys, value, score],
				}),
			], function (err) {
				done(err);
			});
		}, callback);
	};
};
