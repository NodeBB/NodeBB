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

		const conditions = [];
		if (Array.isArray(key) && key.length > 1) {
			conditions.push({ $or: key.map(k => ({ _key: k })) });
		} else {
			conditions.push({ _key: key });
		}

		if (isValueArray && value.length > 1) {
			conditions.push({ $or: value.map(v => ({ value: v })) });
		} else {
			conditions.push({ value: value });
		}
		// Delete documents that match any of the conditions in the filter
		await module.client.getCollection('objects').deleteMany({ filter: { $and: conditions } });
	};

	module.sortedSetsRemove = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		value = helpers.valueToString(value);

		await module.client.getCollection('objects').deleteMany({
			filter: keys.length === 1 ? { _key: keys[0], value } :
				{
					$and: [
						{ $or: keys.map(key => ({ _key: key })) },
						{ value: value },
					],
				},
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
				{
					$and: [
						{ $or: keys.map(key => ({ _key: key })) },
						{ score },
					],
				},
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
