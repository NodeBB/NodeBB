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
		const data = await module.client.getCollection('objects')
			.findOne({ filter: { _key: key } });
		if (data) {
			const newArray = position && position.$position === 0 ?
				[...values, ...data.array || []] : [...data.array || [], ...values];
			await module.client.getCollection('objects')
				.updateOne({ filter: { _key: key }, fields: { array: newArray } });
		} else {
			await module.client.getCollection('objects').insertOne({ _key: key, array: values });
		}
	}

	module.listRemoveLast = async function (key) {
		if (!key) {
			return;
		}
		const value = await module.getListRange(key, -1, -1);
		const data = await module.client.getCollection('objects')
			.findOne({ filter: { _key: key } });
		if (data && data.array && data.array.length > 0) {
			const newArray = data.array.slice(0, -1);
			await module.client.getCollection('objects')
				.updateOne({ filter: { _key: key }, fields: { array: newArray } });
		}
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

		const data = await module.client.getCollection('objects')
			.findOne({ filter: { _key: key } });

		if (data && data.array && data.array.length > 0) {
			const newArray = data.array.filter((item) => {
				if (isArray) {
					return !value.includes(item);
				}
				return item !== value;
			});
			await module.client.getCollection('objects')
				.updateOne({ filter: { _key: key }, fields: { array: newArray } });
		}
	};

	module.listTrim = async function (key, start, stop) {
		if (!key) {
			return;
		}
		const value = await module.getListRange(key, start, stop);
		await module.client.getCollection('objects').updateOne({
			filter: { _key: key },
			fields: { array: value },
		});
	};

	module.getListRange = async function (key, start, stop) {
		if (!key) {
			return;
		}

		const data = await module.client.getCollection('objects').findOne({
			filter: { _key: key },
			fields: { include: ['array'] },
		});
		if (!(data && data.array)) {
			return [];
		}

		return data.array.slice(start, stop !== -1 ? stop + 1 : undefined);
	};

	module.listLength = async function (key) {
		const result = await module.client.getCollection('objects').findOne({
			filter: { _key: key },
			fields: { include: ['array'] },
		});
		// TODO -  works with less item in 'array'
		return result && result.array && Array.isArray(result.array) && result.array.length;
	};
};
