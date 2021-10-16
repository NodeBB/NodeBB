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
		await module.transaction(async (session) => {
			await module.client.collection('objects').deleteMany({
				_key: Array.isArray(key) ? { $in: key } : key,
				value: isValueArray ? { $in: value } : value,
			}, { session });
		});
	};

	module.sortedSetsRemove = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		value = helpers.valueToString(value);
		await module.transaction(async (session) => {
			await module.client.collection('objects').deleteMany({ _key: { $in: keys }, value: value }, { session });
		});
	};

	module.sortedSetsRemoveRangeByScore = async function (keys, min, max) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		const query = { _key: { $in: keys } };
		if (keys.length === 1) {
			query._key = keys[0];
		}
		if (min !== '-inf') {
			query.score = { $gte: parseFloat(min) };
		}
		if (max !== '+inf') {
			query.score = query.score || {};
			query.score.$lte = parseFloat(max);
		}
		await module.transaction(async (session) => {
			await module.client.collection('objects').deleteMany(query, { session });
		});
	};

	module.sortedSetRemoveBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}
		await module.transaction(async (session) => {
			const bulk = module.client.collection('objects').initializeUnorderedBulkOp({ session });
			data.forEach(item => bulk.find({ _key: item[0], value: String(item[1]) }).delete());
			await bulk.execute();
		});
	};
};
