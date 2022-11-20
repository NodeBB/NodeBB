'use strict';
import helpers from '../helpers';


export default  function (module) {

	module.sortedSetRemove = async function (key: string, value: string | Array<string>) {
		if (!key) {
			return;
		}
		const isValueArray = Array.isArray(value);
		if (!value || (isValueArray && !value.length)) {
			return;
		}

		if (isValueArray) {
			value = (value as string[]).map(helpers.valueToString);
		} else {
			value = helpers.valueToString(value);
		}

		await module.client.collection('objects').deleteMany({
			_key: Array.isArray(key) ? { $in: key } : key,
			value: isValueArray ? { $in: value } : value,
		});
	};

	module.sortedSetsRemove = async function (keys: string[], value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		value = helpers.valueToString(value);

		await module.client.collection('objects').deleteMany({ _key: { $in: keys }, value: value });
	};

	module.sortedSetsRemoveRangeByScore = async function (keys: string[], min: number | string, max: number | string) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		const query = { _key: { $in: keys } } as any;
		if (keys.length === 1) {
			query._key = keys[0];
		}
		if (min !== '-inf') {
			query.score = { $gte: parseFloat(min as string) };
		}
		if (max !== '+inf') {
			query.score = query.score || {};
			query.score.$lte = parseFloat(max as string);
		}

		await module.client.collection('objects').deleteMany(query);
	};

	module.sortedSetRemoveBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}
		const bulk = module.client.collection('objects').initializeUnorderedBulkOp();
		data.forEach((item) => bulk.find({ _key: item[0], value: String(item[1]) }).delete());
		await bulk.execute();
	};
};
