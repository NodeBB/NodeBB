'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

	module.listPrepend = async function (key, value) {
		if (!key) {
			return;
		}
		value = Array.isArray(value) ? value : [value];
		value.reverse();
		const exists = await module.isObjectField(key, 'array');
		if (exists) {
			await listPush(key, value, { $position: 0 });
		} else {
			await module.listAppend(key, value);
		}
	};

	module.listAppend = async function (key, value) {
		if (!key) {
			return;
		}
		value = Array.isArray(value) ? value : [value];
		await listPush(key, value);
	};

	async function listPush(key, values, position) {
		values = values.map(helpers.valueToString);
		await module.client.collection('objects').updateOne({
			_key: key,
		}, {
			$push: {
				array: {
					$each: values,
					...(position || {}),
				},
			},
		}, {
			upsert: true,
		});
	}

	module.listRemoveLast = async function (key) {
		if (!key) {
			return;
		}
		const value = await module.getListRange(key, -1, -1);
		module.client.collection('objects').updateOne({ _key: key }, { $pop: { array: 1 } });
		return (value && value.length) ? value[0] : null;
	};

	module.listRemoveAll = async function (key, value) {
		if (!key) {
			return;
		}
		const isArray = Array.isArray(value);
		if (isArray) {
			value = value.map(helpers.valueToString);
		} else {
			value = helpers.valueToString(value);
		}

		await module.client.collection('objects').updateOne({
			_key: key,
		}, {
			$pull: { array: isArray ? { $in: value } : value },
		});
	};

	module.listTrim = async function (key, start, stop) {
		if (!key) {
			return;
		}
		const value = await module.getListRange(key, start, stop);
		await module.client.collection('objects').updateOne({ _key: key }, { $set: { array: value } });
	};

	module.getListRange = async function (key, start, stop) {
		if (!key) {
			return;
		}

		const data = await module.client.collection('objects').findOne({ _key: key }, { array: 1 });
		if (!(data && data.array)) {
			return [];
		}

		return data.array.slice(start, stop !== -1 ? stop + 1 : undefined);
	};

	module.listLength = async function (key) {
		const result = await module.client.collection('objects').aggregate([
			{ $match: { _key: key } },
			{ $project: { count: { $size: '$array' } } },
		]).toArray();
		return Array.isArray(result) && result.length && result[0].count;
	};
};
