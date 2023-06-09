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

		if (isValueArray) {
			value = value.map(helpers.valueToString);
		} else {
			value = helpers.valueToString(value);
		}
		const filter = [];

		if (Array.isArray(key)) {
			key.forEach((k) => {
				if (isValueArray) {
					value.forEach((v) => {
						filter.push({ _key: k, value: v });
					});
				} else {
					filter.push({ _key: k, value: value });
				}
			});
		} else if (isValueArray) {
			value.forEach((v) => {
				filter.push({ _key: key, value: v });
			});
		} else {
			// If neither key nor value are arrays, no need for $or
			await module.client.getCollection('objects').deleteMany({ filter: { _key: key, value: value } });
			return;
		}

		// Delete documents that match any of the conditions in the filter
		await module.client.getCollection('objects').deleteMany({ filter: { $or: filter } });
	};

	module.sortedSetsRemove = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		value = helpers.valueToString(value);

		await module.client.getCollection('objects').deleteMany({
			filter: { $in: keys.map(key => ({ _key: key, value: value })) },
		});
	};

	module.sortedSetsRemoveRangeByScore = async function (keys, min, max) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		const score = {};
		if (min !== '-inf') {
			score.$gte = parseFloat(min);
		}
		if (max !== '+inf') {
			score.$lte = parseFloat(max);
		}

		await module.client.getCollection('objects').deleteMany({
			filter: keys.length === 1 ?
				{ _key: keys[0], score } :
				{ $or: keys.map(key => ({ _key: key, score })) },
		});
	};

	module.sortedSetRemoveBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}
		await Promise.all(
			data.map(item => module.client.getCollection('objects').deleteMany({
				filter: { _key: item[0], value: String(item[1]) },
			}))
		);
	};
};
