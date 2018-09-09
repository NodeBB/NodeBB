'use strict';

module.exports = function (db, module) {
	var helpers = module.helpers.postgres;

	module.sortedSetAdd = function (key, score, value, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		if (Array.isArray(score) && Array.isArray(value)) {
			return sortedSetAddBulk(key, score, value, callback);
		}

		value = helpers.valueToString(value);
		score = parseFloat(score);

		db.query({
			name: 'sortedSetAdd',
			text: `SELECT "zset_addItem"($1::TEXT, $2::TEXT, $3::NUMERIC)`,
			values: [key, value, score],
		}, function (err) {
			callback(err);
		});
	};

	function sortedSetAddBulk(key, scores, values, callback) {
		if (!scores.length || !values.length) {
			return callback();
		}
		if (scores.length !== values.length) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		values = values.map(helpers.valueToString);
		scores = scores.map(function (score) {
			return parseFloat(score);
		});

		helpers.removeDuplicateValues(values, scores);

		db.query({
			name: 'sortedSetAddBulk',
			text: `
SELECT "zset_addItem"($1::TEXT, "value", "score")
  FROM UNNEST($2::TEXT[], $3::NUMERIC[]) vs("value", "score")`,
			values: [key, values, scores],
		}, function (err) {
			callback(err);
		});
	}

	module.sortedSetsAdd = function (keys, score, value, callback) {
		callback = callback || helpers.noop;

		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}

		value = helpers.valueToString(value);
		score = parseFloat(score);

		db.query({
			name: 'sortedSetsAdd',
			text: `
SELECT "zset_addItem"("_key", $2::TEXT, $3::NUMERIC)
  FROM UNNEST($1::TEXT[]) k("_key")`,
			values: [keys, value, score],
		}, function (err) {
			callback(err);
		});
	};
};
