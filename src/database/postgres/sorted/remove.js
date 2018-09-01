'use strict';

module.exports = function (db, module) {
	var helpers = module.helpers.postgres;

	module.sortedSetRemove = function (key, value, callback) {
		function done(err) {
			if (callback) {
				callback(err);
			}
		}

		if (!key) {
			return done();
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
DELETE FROM "legacy_zset"
 WHERE "_key" = ANY($1::TEXT[])
   AND "value" = ANY($2::TEXT[])`,
			values: [key, value],
		}, done);
	};

	module.sortedSetsRemove = function (keys, value, callback) {
		callback = callback || helpers.noop;

		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}

		value = helpers.valueToString(value);

		db.query({
			name: 'sortedSetsRemove',
			text: `
DELETE FROM "legacy_zset"
 WHERE "_key" = ANY($1::TEXT[])
   AND "value" = $2::TEXT`,
			values: [keys, value],
		}, function (err) {
			callback(err);
		});
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
DELETE FROM "legacy_zset"
 WHERE "_key" = ANY($1::TEXT[])
   AND ("score" >= $2::NUMERIC OR $2::NUMERIC IS NULL)
   AND ("score" <= $3::NUMERIC OR $3::NUMERIC IS NULL)`,
			values: [keys, min, max],
		}, function (err) {
			callback(err);
		});
	};
};
