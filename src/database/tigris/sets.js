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
		const data = await module.client.getCollection('objects')
			.findOne({ filter: { _key: key } });

		if (data) {
			const newSet = [...new Set([...data.members || [], ...value])];
			await module.client.getCollection('objects')
				.updateOne({ filter: { _key: key }, fields: { members: newSet } });
		} else {
			await module.client.getCollection('objects')
				.insertOne({ _key: key, members: value });
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
		try {
			await Promise.all(keys.map(async (key) => {
				const data = await module.client.getCollection('objects')
					.findOne({ filter: { _key: key } });
				if (data) {
					const newSet = [...new Set([...data.members || [], ...value])];
					return module.client.getCollection('objects')
						.updateOne({ filter: { _key: key }, fields: { members: newSet } });
				}
				return module.client.getCollection('objects')
					.insertOne({ _key: key, members: value });
			}));
		} catch (err) {
			if (err && err.message.startsWith('E11000 duplicate key error')) {
				return await module.setsAdd(keys, value);
			}
			throw err;
		}
	};

	module.setRemove = async function (key, value) {
		if (Array.isArray(key)) {
			return module.setsRemove(key, value);
		}
		if (!Array.isArray(value)) {
			value = [value];
		}

		value = value.map(v => helpers.valueToString(v));
		const data = await module.client.getCollection('objects')
			.findOne({ filter: { _key: key } });

		if (data) {
			const newSet = [...new Set([...data.members || []].filter(v => !value.includes(v)))];
			await module.client.getCollection('objects')
				.updateOne({
					filter: { _key: key },
					fields: { members: newSet },
				});
		}
	};

	module.setsRemove = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		value = helpers.valueToString(value);

		await Promise.all(keys.map(async (key) => {
			const data = await module.client.getCollection('objects')
				.findOne({ filter: { _key: key } });
			if (data) {
				const newSet = [...new Set([...data.members || []].filter(v => v !== value))];
				return module.client.getCollection('objects')
					.updateOne({ filter: { _key: key }, fields: { members: newSet } });
			}
		}));
	};

	module.isSetMember = async function (key, value) {
		if (!key) {
			return false;
		}
		value = helpers.valueToString(value);

		// TODO - not sure if Tigris checks if value exists in members.
		const item = await module.client.getCollection('objects')
			.findOne({ filter: { _key: key, members: value }, fields: { exclude: ['_id', 'members'] } });
		return item !== null && item !== undefined;
	};

	module.isSetMembers = async function (key, values) {
		if (!key || !Array.isArray(values) || !values.length) {
			return [];
		}
		values = values.map(v => helpers.valueToString(v));

		const result = await module.client.getCollection('objects')
			.findOne({ filter: { _key: key }, fields: { exclude: ['_id', '_key'] } });

		const membersSet = new Set(result && Array.isArray(result.members) ? result.members : []);
		return values.map(v => membersSet.has(v));
	};

	module.isMemberOfSets = async function (sets, value) {
		if (!Array.isArray(sets) || !sets.length) {
			return [];
		}
		value = helpers.valueToString(value);

		const result = await module.client.getCollection('objects')
			.findMany({
				filter: sets.length === 1 ? { _key: sets[0], members: value } :
					{
						$and: [
							{ $or: sets.map(set => ({ _key: set })) },
							{ members: value },
						],
					},
				fields: { exclude: ['_id', 'members'] },
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

		const data = await module.client.getCollection('objects')
			.findOne({ filter: { _key: key }, fields: { exclude: ['_id', '_key'] } });
		return data ? data.members : [];
	};

	module.getSetsMembers = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const data = await module.client.getCollection('objects')
			.findMany({
				filter: keys.length === 1 ? { _key: keys[0] } :
					{ $or: keys.map(key => ({ _key: key })) },
				fields: { exclude: ['_id'] },
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
		const data = await module.client.getCollection('objects')
			.findOne({ filter: { _key: key }, fields: { include: ['members'] } });
		return data && data.members ? data.members.length : 0;
	};

	module.setsCount = async function (keys) {
		const data = await module.client.getCollection('objects')
			.findMany({
				filter: keys.length === 1 ? { _key: keys[0] } :
					{ $or: keys.map(key => ({ _key: key })) },
				fields: { include: ['_key', 'members'] },
			}).toArray();

		const map = _.keyBy(data, '_key');
		return keys.map(key => (map.hasOwnProperty(key) && map[key].members ? map[key].members.length : 0));
	};

	module.setRemoveRandom = async function (key) {
		const data = await module.client.getCollection('objects').findOne({ filter: { _key: key } });
		if (!data) {
			return;
		}

		const randomIndex = Math.floor(Math.random() * data.members.length);
		const value = data.members[randomIndex];
		await module.setRemove(data._key, value);
		return value;
	};
};
