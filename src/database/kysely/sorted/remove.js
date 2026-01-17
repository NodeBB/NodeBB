'use strict';

module.exports = function (module) {
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
		value = value.map(String);

		await module.db.deleteFrom('legacy_zset')
			.where('_key', 'in', key)
			.where('value', 'in', value)
			.execute();
	};

	module.sortedSetsRemove = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		value = String(value);

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

		// Build OR conditions for all key-value pairs
		// This is more efficient than individual deletes
		await module.db.deleteFrom('legacy_zset')
			.where(eb => eb.or(
				data.map(([key, value]) => eb.and([
					eb('_key', '=', key),
					eb('value', '=', String(value)),
				]))
			))
			.execute();
	};
};