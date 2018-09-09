'use strict';

module.exports = function (db, module) {
	var helpers = module.helpers.postgres;

	module.sortedSetRemove = function (key, value, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		if (!Array.isArray(key)) {
			key = [key];
		}

		if (!Array.isArray(value)) {
			value = [value];
		}
		value = value.map(helpers.valueToString);

		db.query({
			name: 'sortedSetRemove',
			text: `
SELECT "zset_removeItem"("_key", "value")
  FROM UNNEST($1::TEXT[]) k("_key")
 CROSS JOIN UNNEST($2::TEXT[]) v("value")`,
			values: [key, value],
		}, function (err) {
			callback(err);
		});
	};

	module.sortedSetsRemove = function (keys, value, callback) {
		callback = callback || helpers.noop;

		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}

		module.sortedSetRemove(keys, value, callback);
	};

	module.sortedSetsRemoveRangeByScore = function (keys, min, max, callback) {
		callback = callback || helpers.noop;

		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}

		if (min === '-inf') {
			min = null;
		}
		if (max === '+inf') {
			max = null;
		}

		db.query({
			name: 'sortedSetsRemoveRangeByScore',
			text: `
SELECT "zset_removeItemsByScore"("_key", $2::NUMERIC, $3::NUMERIC)
  FROM UNNEST($1::TEXT[]) k("_key")`,
			values: [keys, min, max],
		}, function (err) {
			callback(err);
		});
	};
};
