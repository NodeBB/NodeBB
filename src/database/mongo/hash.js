'use strict';

module.exports = function (module) {
	var helpers = require('./helpers');

	var _ = require('lodash');
	const cache = require('../cache').create('mongo');

	module.objectCache = cache;

	module.setObject = async function (key, data) {
		const isArray = Array.isArray(key);
		if (!key || !data || (isArray && !key.length)) {
			return;
		}

		const writeData = helpers.serializeData(data);
		if (isArray) {
			var bulk = module.client.collection('objects').initializeUnorderedBulkOp();
			key.forEach(key => bulk.find({ _key: key }).upsert().updateOne({ $set: writeData }));
			await bulk.execute();
		} else {
			await module.client.collection('objects').updateOne({ _key: key }, { $set: writeData }, { upsert: true, w: 1 });
		}

		cache.delObjectCache(key);
	};

	module.setObjectField = async function (key, field, value) {
		if (!field) {
			return;
		}
		var data = {};
		data[field] = value;
		await module.setObject(key, data);
	};

	module.getObject = async function (key) {
		if (!key) {
			return null;
		}

		const data = await module.getObjects([key]);
		return data && data.length ? data[0] : null;
	};

	module.getObjects = async function (keys) {
		return await module.getObjectsFields(keys, []);
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
		function returnData() {
			var mapped = keys.map(function (key) {
				if (!fields.length) {
					return _.clone(cachedData[key]);
				}

				const item = cachedData[key] || {};
				const result = {};
				fields.forEach((field) => {
					result[field] = item[field] !== undefined ? item[field] : null;
				});
				return result;
			});

			return mapped;
		}

		const unCachedKeys = cache.getUnCachedKeys(keys, cachedData);
		if (!unCachedKeys.length) {
			return returnData();
		}

		var query = { _key: { $in: unCachedKeys } };
		if (unCachedKeys.length === 1) {
			query._key = unCachedKeys[0];
		}
		let data = await module.client.collection('objects').find(query, { projection: { _id: 0 } }).toArray();

		data = data.map(helpers.deserializeData);
		var map = helpers.toMap(data);
		unCachedKeys.forEach(function (key) {
			cachedData[key] = map[key] || null;
			cache.set(key, cachedData[key]);
		});

		return returnData();
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
		fields.forEach(function (field) {
			field = helpers.fieldToString(field);
			data[field] = 1;
		});

		const item = await module.client.collection('objects').findOne({ _key: key }, { projection: data });
		const results = fields.map(f => !!item && item[f] !== undefined && item[f] !== null);
		return results;
	};

	module.deleteObjectField = async function (key, field) {
		await module.deleteObjectFields(key, [field]);
	};

	module.deleteObjectFields = async function (key, fields) {
		if (!key || !Array.isArray(fields) || !fields.length) {
			return;
		}
		fields = fields.filter(Boolean);
		if (!fields.length) {
			return;
		}

		var data = {};
		fields.forEach(function (field) {
			field = helpers.fieldToString(field);
			data[field] = '';
		});

		await module.client.collection('objects').updateOne({ _key: key }, { $unset: data });
		cache.delObjectCache(key);
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

		var increment = {};
		field = helpers.fieldToString(field);
		increment[field] = value;

		if (Array.isArray(key)) {
			var bulk = module.client.collection('objects').initializeUnorderedBulkOp();
			key.forEach(function (key) {
				bulk.find({ _key: key }).upsert().update({ $inc: increment });
			});
			await bulk.execute();
			cache.delObjectCache(key);
			const result = await module.getObjectsFields(key, [field]);
			return result.map(data => data && data[field]);
		}

		const result = await module.client.collection('objects').findOneAndUpdate({ _key: key }, { $inc: increment }, { returnOriginal: false, upsert: true });
		cache.delObjectCache(key);
		return result && result.value ? result.value[field] : null;
	};
};
