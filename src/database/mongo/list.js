'use strict';

module.exports = function (db, module) {
	var helpers = require('./helpers');

	module.listPrepend = async function (key, value) {
		if (!key) {
			return;
		}

		value = helpers.valueToString(value);

		const exists = await module.isObjectField(key, 'array');
		if (exists) {
			await db.collection('objects').updateOne({ _key: key }, { $push: { array: { $each: [value], $position: 0 } } }, { upsert: true, w: 1 });
		} else {
			await module.listAppend(key, value);
		}
	};

	module.listAppend = async function (key, value) {
		if (!key) {
			return;
		}
		value = helpers.valueToString(value);
		await db.collection('objects').updateOne({ _key: key }, { $push: { array: value } }, { upsert: true, w: 1 });
	};

	module.listRemoveLast = async function (key) {
		if (!key) {
			return;
		}
		const value = await module.getListRange(key, -1, -1);
		db.collection('objects').updateOne({ _key: key }, { $pop: { array: 1 } });
		return (value && value.length) ? value[0] : null;
	};

	module.listRemoveAll = async function (key, value) {
		if (!key) {
			return;
		}
		value = helpers.valueToString(value);

		await db.collection('objects').updateOne({ _key: key }, { $pull: { array: value } });
	};

	module.listTrim = async function (key, start, stop) {
		if (!key) {
			return;
		}
		const value = await module.getListRange(key, start, stop);
		await db.collection('objects').updateOne({ _key: key }, { $set: { array: value } });
	};

	module.getListRange = async function (key, start, stop) {
		if (!key) {
			return;
		}

		const data = await db.collection('objects').findOne({ _key: key }, { array: 1 });
		if (!(data && data.array)) {
			return [];
		}

		return data.array.slice(start, stop !== -1 ? stop + 1 : undefined);
	};

	module.listLength = async function (key) {
		const result = await db.collection('objects').aggregate([
			{ $match: { _key: key } },
			{ $project: { count: { $size: '$array' } } },
		]).toArray();
		return Array.isArray(result) && result.length && result[0].count;
	};
};
