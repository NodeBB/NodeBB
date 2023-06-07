'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

	const cache = require('../cache').create('tigris');

	module.objectCache = cache;

	module.setObject = async function (key, data) {
		const isArray = Array.isArray(key);
		if (!key || !data || (isArray && !key.length)) {
			return;
		}

		const writeData = helpers.serializeData(data);
		if (!Object.keys(writeData).length) {
			return;
		}
		try {
			const objectCollection = module.client.getCollection('objects');
			if (isArray) {
				await module.client.transact(async (tx) => {
					// TODO -  Confirm this is woking as expected.
					await Promise.all(key.map(async (key) => {
						await module.upsert(key);
						return objectCollection
							.updateOne({ filter: { _key: key }, fields: writeData }, tx);
					}));
				});
			} else {
				await module.upsert(key);
				await objectCollection.updateOne({ filter: { _key: key }, fields: writeData });
			}
		} catch (err) {
			if (err && err.message.startsWith('E11000 duplicate key error')) {
				return await module.setObject(key, data);
			}
			throw err;
		}

		cache.del(key);
	};

	module.setObjectBulk = async function (...args) {
		let data = args[0];
		if (!Array.isArray(data) || !data.length) {
			return;
		}
		if (Array.isArray(args[1])) {
			console.warn('[deprecated] db.setObjectBulk(keys, data) usage is deprecated, please use db.setObjectBulk(data)');
			// conver old format to new format for backwards compatibility
			data = args[0].map((key, i) => [key, args[1][i]]);
		}

		try {
			await module.client.transact(async (tx) => {
				// TODO -  Confirm this is woking as expected.
				await Promise.all(
					data.map(async (item) => {
						const writeData = helpers.serializeData(item[1]);
						if (Object.keys(writeData).length) {
							await module.upsert(item[0]);
							return module.client.getCollection('objects')
								.updateOne({ filter: { _key: item[0] }, fields: writeData }, tx);
						}
						return Promise.resolve();
					})
				);
			});
		} catch (err) {
			if (err && err.message.startsWith('E11000 duplicate key error')) {
				return await module.setObjectBulk(data);
			}
			throw err;
		}

		cache.del(data.map(item => item[0]));
	};

	module.setObjectField = async function (key, field, value) {
		if (!field) {
			return;
		}
		const data = {};
		data[field] = value;
		await module.setObject(key, data);
	};

	module.getObject = async function (key, fields = []) {
		if (!key) {
			return null;
		}

		const data = await module.getObjects([key], fields);
		return data && data.length ? data[0] : null;
	};

	module.getObjects = async function (keys, fields = []) {
		return await module.getObjectsFields(keys, fields);
	};

	module.getObjectField = async function (key, field) {
		if (!key) {
			return null;
		}
		const cachedData = {};
		cache.getUnCachedKeys([key], cachedData);
		if (cachedData[key]) {
			return cachedData[key].hasOwnProperty(field) ? cachedData[key][field] : null;
		}
		field = helpers.fieldToString(field);
		const item = await module.client.getCollection('objects').findOne({ filter: { _key: key }, fields: { include: [field] } });
		if (!item) {
			return null;
		}
		return item.hasOwnProperty(field) ? item[field] : null;
	};

	module.getObjectFields = async function (key, fields) {
		if (!key) {
			return null;
		}
		const data = await module.getObjectsFields([key], fields);
		return data ? data[0] : null;
	};

	module.getObjectsFields = async function (keys, fields) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const cachedData = {};
		const unCachedKeys = cache.getUnCachedKeys(keys, cachedData);
		let data = [];
		if (unCachedKeys.length >= 1) {
			data = await module.client.getCollection('objects').findMany(
				{
					filter: unCachedKeys.length === 1 ? { _key: unCachedKeys[0] } :
						{ $or: unCachedKeys.map(key => ({ _key: key })) },
					fields: { exclude: ['_id'] },
				}
			).toArray();

			data = data.map(helpers.deserializeData);
		}

		const map = helpers.toMap(data);
		unCachedKeys.forEach((key) => {
			cachedData[key] = map[key] || null;
			cache.set(key, cachedData[key]);
		});

		if (!Array.isArray(fields) || !fields.length) {
			return keys.map(key => (cachedData[key] ? { ...cachedData[key] } : null));
		}
		return keys.map((key) => {
			const item = cachedData[key] || {};
			const result = {};
			fields.forEach((field) => {
				result[field] = item[field] !== undefined ? item[field] : null;
			});
			return result;
		});
	};

	module.getObjectKeys = async function (key) {
		const data = await module.getObject(key);
		return data ? Object.keys(data) : [];
	};

	module.getObjectValues = async function (key) {
		const data = await module.getObject(key);
		return data ? Object.values(data) : [];
	};

	module.isObjectField = async function (key, field) {
		const data = await module.isObjectFields(key, [field]);
		return Array.isArray(data) && data.length ? data[0] : false;
	};

	module.isObjectFields = async function (key, fields) {
		if (!key) {
			return;
		}

		const data = [];
		fields.forEach((field) => {
			field = helpers.fieldToString(field);
			if (field) {
				data.push(field);
			}
		});
		const item = await module.client.getCollection('objects')
			.findOne({ filter: { _key: key }, fields: { include: data } });

		const results = fields.map(f => !!item && item[f] !== undefined && item[f] !== null);
		return results;
	};

	module.deleteObjectField = async function (key, field) {
		await module.deleteObjectFields(key, [field]);
	};

	module.deleteObjectFields = async function (key, fields) {
		if (!key || (Array.isArray(key) && !key.length) || !Array.isArray(fields) || !fields.length) {
			return;
		}
		fields = fields.filter(Boolean);
		if (!fields.length) {
			return;
		}

		const data = {};
		fields.forEach((field) => {
			field = helpers.fieldToString(field);
			data[field] = null;
		});
		if (Array.isArray(key)) {
			await module.client.getCollection('objects').updateMany({ filter: { $or: key.map(k => ({ _key: k })) }, fields: data });
		} else {
			await module.client.getCollection('objects').updateOne({ filter: { _key: key }, fields: data });
		}

		cache.del(key);
	};

	module.incrObjectField = async function (key, field) {
		return await module.incrObjectFieldBy(key, field, 1);
	};

	module.decrObjectField = async function (key, field) {
		return await module.incrObjectFieldBy(key, field, -1);
	};

	module.incrObjectFieldBy = async function (key, field, value) {
		value = parseInt(value, 10);
		if (!key || isNaN(value)) {
			return null;
		}

		const increment = {};
		field = helpers.fieldToString(field);
		increment[field] = value;
		const collection = module.client.getCollection('objects');
		if (Array.isArray(key)) {
			await module.client.transact(async (tx) => {
				await Promise.all(key.map(async (key) => {
					await module.upsert(key);
					return collection.updateMany({
						filter: { _key: key },
						fields: { $increment: increment },
					}, tx);
				}));
			});

			cache.del(key);
			const result = await module.getObjectsFields(key, [field]);
			return result.map(data => data && data[field]);
		}
		try {
			await module.upsert(key);
			await module.client.getCollection('objects').updateOne({
				filter: { _key: key },
				fields: { $increment: increment },
			});
			cache.del(key);

			field = helpers.fieldToString(field);
			const item = await module.client.getCollection('objects')
				.findOne({ filter: { _key: key }, fields: { include: [field] } });

			return item && item.hasOwnProperty(field) ? item[field] : null;
		} catch (err) {
			// if there is duplicate key error retry the upsert
			// https://github.com/NodeBB/NodeBB/issues/4467
			// https://jira.mongodb.org/browse/SERVER-14322
			// https://docs.mongodb.org/manual/reference/command/findAndModify/#upsert-and-unique-index
			if (err && err.message.startsWith('E11000 duplicate key error')) {
				return await module.incrObjectFieldBy(key, field, value);
			}
			throw err;
		}
	};

	module.incrObjectFieldByBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}
		const collection = module.client.getCollection('objects');
		await module.client.transact(async (tx) => {
			await Promise.all(data.map(async (item) => {
				const increment = {};
				for (const [field, value] of Object.entries(item[1])) {
					increment[helpers.fieldToString(field)] = value;
				}
				await module.upsert(item[0]);
				return collection
					.updateMany({ filter: { _key: item[0] }, fields: { $increment: increment } }, tx);
			}));
		});

		cache.del(data.map(item => item[0]));
	};
};
