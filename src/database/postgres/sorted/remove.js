'use strict';

module.exports = function (db, module) {
	var helpers = require('../helpers');

	module.sortedSetRemove = async function (key, value) {
		if (!key) {
			return;
		}
		const isValueArray = Array.isArray(value);
		if (!value || (isValueArray && !value.length)) {
			return;
		}

		if (!Array.isArray(key)) {
			key = [key];
		}

		if (!isValueArray) {
			value = [value];
		}
		value = value.map(helpers.valueToString);
		await db.query({
			name: 'sortedSetRemove',
			text: `
DELETE FROM "legacy_zset"
 WHERE "_key" = ANY($1::TEXT[])
   AND "value" = ANY($2::TEXT[])`,
			values: [key, value],
		});
	};

	module.sortedSetsRemove = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		value = helpers.valueToString(value);

		await db.query({
			name: 'sortedSetsRemove',
			text: `
DELETE FROM "legacy_zset"
 WHERE "_key" = ANY($1::TEXT[])
   AND "value" = $2::TEXT`,
			values: [keys, value],
		});
	};

	module.sortedSetsRemoveRangeByScore = async function (keys, min, max) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		if (min === '-inf') {
			min = null;
		}
		if (max === '+inf') {
			max = null;
		}

		await db.query({
			name: 'sortedSetsRemoveRangeByScore',
			text: `
DELETE FROM "legacy_zset"
 WHERE "_key" = ANY($1::TEXT[])
   AND ("score" >= $2::NUMERIC OR $2::NUMERIC IS NULL)
   AND ("score" <= $3::NUMERIC OR $3::NUMERIC IS NULL)`,
			values: [keys, min, max],
		});
	};
};
