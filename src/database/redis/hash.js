'use strict';

module.exports = function (redisClient, module) {
	var helpers = module.helpers.redis;

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
		await redisClient.async.hmset(key, data);
		cache.delObjectCache(key);
	};

	module.setObjectField = async function (key, field, value) {
		if (!field) {
			return;
		}
		await redisClient.async.hset(key, field, value);
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
		return await redisClient.async.hget(key, field);
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
			const batch = redisClient.batch();
			unCachedKeys.forEach(k => batch.hgetall(k));
			data = await helpers.execBatch(batch);
		} else if (unCachedKeys.length === 1) {
			data = [await redisClient.async.hgetall(unCachedKeys[0])];
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
		return await redisClient.async.hkeys(key);
	};

	module.getObjectValues = function (key, callback) {
		redisClient.hvals(key, callback);
	};

	module.isObjectField = function (key, field, callback) {
		redisClient.hexists(key, field, function (err, exists) {
			callback(err, exists === 1);
		});
	};

	module.isObjectFields = function (key, fields, callback) {
		helpers.execKeyValues(redisClient, 'batch', 'hexists', key, fields, function (err, results) {
			callback(err, Array.isArray(results) ? helpers.resultsToBool(results) : null);
		});
	};

	module.deleteObjectField = function (key, field, callback) {
		callback = callback || function () {};
		if (key === undefined || key === null || field === undefined || field === null) {
			return setImmediate(callback);
		}
		redisClient.hdel(key, field, function (err) {
			cache.delObjectCache(key);
			callback(err);
		});
	};

	module.deleteObjectFields = function (key, fields, callback) {
		helpers.execKeyValues(redisClient, 'batch', 'hdel', key, fields, function (err) {
			cache.delObjectCache(key);
			callback(err);
		});
	};

	module.incrObjectField = function (key, field, callback) {
		module.incrObjectFieldBy(key, field, 1, callback);
	};

	module.decrObjectField = function (key, field, callback) {
		module.incrObjectFieldBy(key, field, -1, callback);
	};

	module.incrObjectFieldBy = function (key, field, value, callback) {
		callback = callback || helpers.noop;
		function done(err, result) {
			if (err) {
				return callback(err);
			}
			cache.delObjectCache(key);
			callback(null, Array.isArray(result) ? result.map(value => parseInt(value, 10)) : parseInt(result, 10));
		}
		value = parseInt(value, 10);
		if (!key || isNaN(value)) {
			return callback(null, null);
		}
		if (Array.isArray(key)) {
			var batch = redisClient.batch();
			key.forEach(function (key) {
				batch.hincrby(key, field, value);
			});
			batch.exec(done);
		} else {
			redisClient.hincrby(key, field, value, done);
		}
	};
};
