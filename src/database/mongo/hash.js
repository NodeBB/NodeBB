'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

	const cache = require('../cache').create('mongo');

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
			if (isArray) {
				const bulk = module.client.collection('objects').initializeUnorderedBulkOp();
				key.forEach(key => bulk.find({ _key: key }).upsert().updateOne({ $set: writeData }));
				await bulk.execute();
			} else {
				await module.client.collection('objects').updateOne({ _key: key }, { $set: writeData }, { upsert: true });
			}
		} catch (err) {
			if (err && err.message.includes('E11000 duplicate key error')) {
				console.log(new Error('e11000').stack, key, data);
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
			let bulk;
			data.forEach((item) => {
				const writeData = helpers.serializeData(item[1]);
				if (Object.keys(writeData).length) {
					if (!bulk) {
						bulk = module.client.collection('objects').initializeUnorderedBulkOp();
					}
					bulk.find({ _key: item[0] }).upsert().updateOne({ $set: writeData });
				}
			});
			if (bulk) {
				await bulk.execute();
			}
		} catch (err) {
			if (err && err.message.includes('E11000 duplicate key error')) {
				console.log(new Error('e11000').stack, data);
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
		const item = await module.client.collection('objects').findOne({ _key: key }, { projection: { _id: 0, [field]: 1 } });
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

		if (unCachedKeys.length >= 1) {
			let data = await module.client.collection('objects').find(
				{ _key: unCachedKeys.length === 1 ? unCachedKeys[0] : { $in: unCachedKeys } },
				{ projection: { _id: 0 } }
			).toArray();
			data = data.map(helpers.deserializeData);

			const map = helpers.toMap(data);
			unCachedKeys.forEach((key) => {
				cachedData[key] = map[key] || null;
				cache.set(key, cachedData[key]);
			});
		}

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

		const data = {};
		fields.forEach((field) => {
			field = helpers.fieldToString(field);
			if (field) {
				data[field] = 1;
			}
		});

		const item = await module.client.collection('objects').findOne({ _key: key }, { projection: data });
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
			data[field] = '';
		});
		if (Array.isArray(key)) {
			await module.client.collection('objects').updateMany({ _key: { $in: key } }, { $unset: data });
		} else {
			await module.client.collection('objects').updateOne({ _key: key }, { $unset: data });
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

		if (Array.isArray(key)) {
			const bulk = module.client.collection('objects').initializeUnorderedBulkOp();
			key.forEach((key) => {
				bulk.find({ _key: key }).upsert().update({ $inc: increment });
			});
			await bulk.execute();
			cache.del(key);
			const result = await module.getObjectsFields(key, [field]);
			return result.map(data => data && data[field]);
		}
		try {
			const result = await module.client.collection('objects').findOneAndUpdate({
				_key: key,
			}, {
				$inc: increment,
			}, {
				returnDocument: 'after',
				includeResultMetadata: true,
				upsert: true,
			});
			cache.del(key);
			return result && result.value ? result.value[field] : null;
		} catch (err) {
			// if there is duplicate key error retry the upsert
			// https://github.com/NodeBB/NodeBB/issues/4467
			// https://jira.mongodb.org/browse/SERVER-14322
			// https://docs.mongodb.org/manual/reference/command/findAndModify/#upsert-and-unique-index
			if (err && err.message.includes('E11000 duplicate key error')) {
				console.log(new Error('e11000').stack, key, field, value);
				return await module.incrObjectFieldBy(key, field, value);
			}
			throw err;
		}
	};

	module.incrObjectFieldByBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}

		const bulk = module.client.collection('objects').initializeUnorderedBulkOp();

		data.forEach((item) => {
			const increment = {};
			for (const [field, value] of Object.entries(item[1])) {
				increment[helpers.fieldToString(field)] = value;
			}
			bulk.find({ _key: item[0] }).upsert().update({ $inc: increment });
		});
		await bulk.execute();
		cache.del(data.map(item => item[0]));
	};
};
