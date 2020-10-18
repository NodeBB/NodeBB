'use strict';

module.exports = function (module) {
	var helpers = require('./helpers');

	const _ = require('lodash');

	const cache = require('../cache').create('redis');

	module.objectCache = cache;

	module.setObject = async function (key, data) {
		if (!key || !data) {
			return;
		}

		if (data.hasOwnProperty('')) {
			delete data[''];
		}

		Object.keys(data).forEach(function (key) {
			if (data[key] === undefined || data[key] === null) {
				delete data[key];
			}
		});

		if (!Object.keys(data).length) {
			return;
		}
		if (Array.isArray(key)) {
			const batch = module.client.batch();
			key.forEach(k => batch.hmset(k, data));
			await helpers.execBatch(batch);
		} else {
			await module.client.async.hmset(key, data);
		}

		cache.delObjectCache(key);
	};

	module.setObjectField = async function (key, field, value) {
		if (!field) {
			return;
		}
		if (Array.isArray(key)) {
			const batch = module.client.batch();
			key.forEach(k => batch.hset(k, field, value));
			await helpers.execBatch(batch);
		} else {
			await module.client.async.hset(key, field, value);
		}

		cache.delObjectCache(key);
	};

	module.getObject = async function (key) {
		if (!key) {
			return null;
		}

		const data = await module.getObjectsFields([key], []);
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
		return await module.client.async.hget(key, String(field));
	};

	module.getObjectFields = async function (key, fields) {
		if (!key) {
			return null;
		}
		const results = await module.getObjectsFields([key], fields);
		return results ? results[0] : null;
	};

	module.getObjectsFields = async function (keys, fields) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		if (!Array.isArray(fields)) {
			return keys.map(function () { return {}; });
		}
		const cachedData = {};
		const unCachedKeys = cache.getUnCachedKeys(keys, cachedData);

		let data = [];
		if (unCachedKeys.length > 1) {
			const batch = module.client.batch();
			unCachedKeys.forEach(k => batch.hgetall(k));
			data = await helpers.execBatch(batch);
		} else if (unCachedKeys.length === 1) {
			data = [await module.client.async.hgetall(unCachedKeys[0])];
		}

		unCachedKeys.forEach(function (key, i) {
			cachedData[key] = data[i] || null;
			cache.set(key, cachedData[key]);
		});

		const mapped = keys.map(function (key) {
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
	};

	module.getObjectKeys = async function (key) {
		return await module.client.async.hkeys(key);
	};

	module.getObjectValues = async function (key) {
		return await module.client.async.hvals(key);
	};

	module.isObjectField = async function (key, field) {
		const exists = await module.client.async.hexists(key, field);
		return exists === 1;
	};

	module.isObjectFields = async function (key, fields) {
		const batch = module.client.batch();
		fields.forEach(f => batch.hexists(String(key), String(f)));
		const results = await helpers.execBatch(batch);
		return Array.isArray(results) ? helpers.resultsToBool(results) : null;
	};

	module.deleteObjectField = async function (key, field) {
		if (key === undefined || key === null || field === undefined || field === null) {
			return;
		}
		await module.client.async.hdel(key, field);
		cache.delObjectCache(key);
	};

	module.deleteObjectFields = async function (key, fields) {
		if (!key || !Array.isArray(fields) || !fields.length) {
			return;
		}
		fields = fields.filter(Boolean);
		if (!fields.length) {
			return;
		}
		await module.client.async.hdel(key, fields);
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
		let result;
		if (Array.isArray(key)) {
			var batch = module.client.batch();
			key.forEach(k => batch.hincrby(k, field, value));
			result = await helpers.execBatch(batch);
		} else {
			result = await module.client.async.hincrby(key, field, value);
		}
		cache.delObjectCache(key);
		return Array.isArray(result) ? result.map(value => parseInt(value, 10)) : parseInt(result, 10);
	};
};
