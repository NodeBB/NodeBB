'use strict';

module.exports = function (module) {
	const helpers = require('../helpers');

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

		await module.db.deleteFrom('legacy_zset')
			.where('_key', 'in', key)
			.where('value', 'in', value)
			.execute();
	};

	module.sortedSetsRemove = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		value = helpers.valueToString(value);

		await module.db.deleteFrom('legacy_zset')
			.where('_key', 'in', keys)
			.where('value', '=', value)
			.execute();
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

		let query = module.db.deleteFrom('legacy_zset')
			.where('_key', 'in', keys);

		if (min !== null) {
			query = query.where('score', '>=', min);
		}
		if (max !== null) {
			query = query.where('score', '<=', max);
		}

		await query.execute();
	};

	module.sortedSetRemoveBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}

		// Delete each key-value pair individually
		// For MySQL 4 compatibility we can't use modern tuple IN syntax
		for (const [key, value] of data) {
			await module.db.deleteFrom('legacy_zset')
				.where('_key', '=', key)
				.where('value', '=', helpers.valueToString(value))
				.execute();
		}
	};
};