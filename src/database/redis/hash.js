'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

	const cache = require('../cache').create('redis');

	module.objectCache = cache;

	module.setObject = async function (key, data) {
		if (!key || !data) {
			return;
		}

		if (data.hasOwnProperty('')) {
			delete data[''];
		}

		Object.keys(data).forEach((key) => {
			if (data[key] === undefined || data[key] === null) {
				delete data[key];
			}
		});

		if (!Object.keys(data).length) {
			return;
		}
		const strObj = helpers.objectFieldsToString(data);
		if (Array.isArray(key)) {
			const batch = module.client.batch();
			key.forEach(k => batch.hSet(k, strObj));
			await helpers.execBatch(batch);
		} else {
			await module.client.hSet(key, strObj);
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

		const batch = module.client.batch();
		data.forEach((item) => {
			Object.keys(item[1]).forEach((key) => {
				if (item[1][key] === undefined || item[1][key] === null) {
					delete item[1][key];
				}
			});
			if (Object.keys(item[1]).length) {
				batch.hSet(item[0], helpers.objectFieldsToString(item[1]));
			}
		});

		await helpers.execBatch(batch);
		cache.del(data.map(item => item[0]));
	};

	module.setObjectField = async function (key, field, value) {
		if (!field) {
			return;
		}
		if (value === null || value === undefined) {
			return;
		}
		if (Array.isArray(key)) {
			const batch = module.client.batch();
			key.forEach(k => batch.hSet(k, field, String(value)));
			await helpers.execBatch(batch);
		} else {
			await module.client.hSet(key, field, String(value));
		}

		cache.del(key);
	};

	module.getObject = async function (key, fields = []) {
		if (!key) {
			return null;
		}

		const data = await module.getObjectsFields([key], fields);
		return data && data.length ? data[0] : null;
	};

	module.getObjects = async function (keys, fields = []) {
		return await module.getObjectsFields(keys, fields);
	};

	module.getObjectField = async function (key, field) {
		if (!key || !field) {
			return null;
		}
		const cachedData = {};
		cache.getUnCachedKeys([key], cachedData);
		if (cachedData[key]) {
			return Object.hasOwn(cachedData[key], field) ? cachedData[key][field] : null;
		}
		return await module.client.hGet(key, String(field));
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

		const cachedData = {};
		const unCachedKeys = cache.getUnCachedKeys(keys, cachedData);

		let data = [];
		if (unCachedKeys.length > 1) {
			const batch = module.client.batch();
			unCachedKeys.forEach(k => batch.hGetAll(k));
			data = await helpers.execBatch(batch);
		} else if (unCachedKeys.length === 1) {
			data = [await module.client.hGetAll(unCachedKeys[0])];
		}

		// convert empty objects into null for back-compat with node_redis
		data = data.map((elem) => {
			if (!Object.keys(elem).length) {
				return null;
			}
			return elem;
		});

		unCachedKeys.forEach((key, i) => {
			cachedData[key] = data[i] || null;
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
		return await module.client.hKeys(key);
	};

	module.getObjectValues = async function (key) {
		return await module.client.hVals(key);
	};

	module.isObjectField = async function (key, field) {
		const exists = await module.client.hExists(key, String(field));
		return exists === 1;
	};

	module.isObjectFields = async function (key, fields) {
		const batch = module.client.batch();
		fields.forEach(f => batch.hExists(String(key), String(f)));
		const results = await helpers.execBatch(batch);
		return Array.isArray(results) ? helpers.resultsToBool(results) : null;
	};

	module.deleteObjectField = async function (key, field) {
		if (key === undefined || key === null || field === undefined || field === null) {
			return;
		}
		field = field.toString();
		if (field) {
			await module.client.hDel(key, field);
			cache.del(key);
		}
	};

	module.deleteObjectFields = async function (key, fields) {
		if (!key || (Array.isArray(key) && !key.length) || !Array.isArray(fields) || !fields.length) {
			return;
		}
		fields = fields.filter(Boolean);
		if (!fields.length) {
			return;
		}
		if (Array.isArray(key)) {
			const batch = module.client.batch();
			key.forEach(k => batch.hDel(k, fields));
			await helpers.execBatch(batch);
		} else {
			await module.client.hDel(key, fields);
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
		let result;
		if (Array.isArray(key)) {
			const batch = module.client.batch();
			key.forEach(k => batch.hIncrBy(k, field, value));
			result = await helpers.execBatch(batch);
		} else {
			result = await module.client.hIncrBy(key, field, value);
		}
		cache.del(key);
		return Array.isArray(result) ? result.map(value => parseInt(value, 10)) : parseInt(result, 10);
	};

	module.incrObjectFieldByBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}

		const batch = module.client.batch();
		data.forEach((item) => {
			for (const [field, value] of Object.entries(item[1])) {
				batch.hIncrBy(item[0], field, value);
			}
		});
		await helpers.execBatch(batch);
		cache.del(data.map(item => item[0]));
	};
};
