'use strict';

module.exports = function (module) {
	const _ = require('lodash');
	const helpers = require('./helpers');

	module.setAdd = async function (key, value) {
		if (!Array.isArray(value)) {
			value = [value];
		}
		if (!value.length) {
			return;
		}
		value = value.map(v => helpers.valueToString(v));

		try {
			await module.client.collection('objects').updateOne({
				_key: key,
			}, {
				$addToSet: {
					members: {
						$each: value,
					},
				},
			}, {
				upsert: true,
			});
		} catch (err) {
			if (err && err.message.includes('E11000 duplicate key error')) {
				console.log(new Error('e11000').stack, key, value);
				return await module.setAdd(key, value);
			}
			throw err;
		}
	};

	module.setsAdd = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		if (!Array.isArray(value)) {
			value = [value];
		}

		value = value.map(v => helpers.valueToString(v));

		const bulk = module.client.collection('objects').initializeUnorderedBulkOp();

		for (let i = 0; i < keys.length; i += 1) {
			bulk.find({ _key: keys[i] }).upsert().updateOne({
				$addToSet: {
					members: {
						$each: value,
					},
				},
			});
		}
		try {
			await bulk.execute();
		} catch (err) {
			if (err && err.message.includes('E11000 duplicate key error')) {
				console.log(new Error('e11000').stack, keys, value);
				return await module.setsAdd(keys, value);
			}
			throw err;
		}
	};

	module.setRemove = async function (key, value) {
		if (!Array.isArray(value)) {
			value = [value];
		}

		value = value.map(v => helpers.valueToString(v));

		await module.client.collection('objects').updateMany({
			_key: Array.isArray(key) ? { $in: key } : key,
		}, {
			$pullAll: { members: value },
		});
	};

	module.setsRemove = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		value = helpers.valueToString(value);

		await module.client.collection('objects').updateMany({
			_key: { $in: keys },
		}, {
			$pull: { members: value },
		});
	};

	module.isSetMember = async function (key, value) {
		if (!key) {
			return false;
		}
		value = helpers.valueToString(value);

		const item = await module.client.collection('objects').findOne({
			_key: key, members: value,
		}, {
			projection: { _id: 0, members: 0 },
		});
		return item !== null && item !== undefined;
	};

	module.isSetMembers = async function (key, values) {
		if (!key || !Array.isArray(values) || !values.length) {
			return [];
		}
		values = values.map(v => helpers.valueToString(v));

		const result = await module.client.collection('objects').findOne({
			_key: key,
		}, {
			projection: { _id: 0, _key: 0 },
		});
		const membersSet = new Set(result && Array.isArray(result.members) ? result.members : []);
		return values.map(v => membersSet.has(v));
	};

	module.isMemberOfSets = async function (sets, value) {
		if (!Array.isArray(sets) || !sets.length) {
			return [];
		}
		value = helpers.valueToString(value);

		const result = await module.client.collection('objects').find({
			_key: { $in: sets }, members: value,
		}, {
			projection: { _id: 0, members: 0 },
		}).toArray();

		const map = {};
		result.forEach((item) => {
			map[item._key] = true;
		});

		return sets.map(set => !!map[set]);
	};

	module.getSetMembers = async function (key) {
		if (!key) {
			return [];
		}

		const data = await module.client.collection('objects').findOne({
			_key: key,
		}, {
			projection: { _id: 0, _key: 0 },
		});
		return data ? data.members : [];
	};

	module.getSetsMembers = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const data = await module.client.collection('objects').find({
			_key: { $in: keys },
		}, {
			projection: { _id: 0 },
		}).toArray();

		const sets = {};
		data.forEach((set) => {
			sets[set._key] = set.members || [];
		});

		return keys.map(k => sets[k] || []);
	};

	module.setCount = async function (key) {
		if (!key) {
			return 0;
		}
		const data = await module.client.collection('objects').aggregate([
			{ $match: { _key: key } },
			{ $project: { _id: 0, count: { $size: '$members' } } },
		]).toArray();
		return Array.isArray(data) && data.length ? data[0].count : 0;
	};

	module.setsCount = async function (keys) {
		const data = await module.client.collection('objects').aggregate([
			{ $match: { _key: { $in: keys } } },
			{ $project: { _id: 0, _key: 1, count: { $size: '$members' } } },
		]).toArray();
		const map = _.keyBy(data, '_key');
		return keys.map(key => (map.hasOwnProperty(key) ? map[key].count : 0));
	};

	module.setRemoveRandom = async function (key) {
		const data = await module.client.collection('objects').findOne({ _key: key });
		if (!data) {
			return;
		}

		const randomIndex = Math.floor(Math.random() * data.members.length);
		const value = data.members[randomIndex];
		await module.setRemove(data._key, value);
		return value;
	};
};
