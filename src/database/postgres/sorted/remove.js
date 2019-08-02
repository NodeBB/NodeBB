'use strict';

module.exports = function (module) {
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
		await module.pool.query({
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

		await module.pool.query({
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

		await module.pool.query({
			name: 'sortedSetsRemoveRangeByScore',
			text: `
DELETE FROM "legacy_zset"
 WHERE "_key" = ANY($1::TEXT[])
   AND ("score" >= $2::NUMERIC OR $2::NUMERIC IS NULL)
   AND ("score" <= $3::NUMERIC OR $3::NUMERIC IS NULL)`,
			values: [keys, min, max],
		});
	};

	module.sortedSetRemoveBulk = async function (data) {
		// const keys = [];
		// const values = [];

		// data.forEach(function (item) {
		// 	keys.push(item[0]);
		// 	values.push(item[1]);
		// });

		const promises = data.map(item => module.sortedSetRemove(item[0], item[1]));
		await Promise.all(promises);

		// TODO
		// 		await query({
		// 			name: 'sortedSetRemoveBulk',
		// 			text: `
		// DELETE FROM "legacy_zset"
		// SELECT k, v
		// FROM UNNEST($1::TEXT[], $2::TEXT[]) vs(k, v)`,
		// 			values: [keys, values],
		// 		});
	};
};
