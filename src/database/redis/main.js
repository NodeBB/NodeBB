'use strict';

module.exports = function (redisClient, module) {
	var helpers = require('./helpers');

	module.flushdb = async function () {
		await redisClient.async.send_command('flushdb', []);
	};

	module.emptydb = async function () {
		await module.flushdb();
		module.objectCache.resetObjectCache();
	};

	module.exists = async function (key) {
		if (Array.isArray(key)) {
			const batch = redisClient.batch();
			key.forEach(key => batch.exists(key));
			const data = await helpers.execBatch(batch);
			return data.map(exists => exists === 1);
		}
		const exists = await redisClient.async.exists(key);
		return exists === 1;
	};

	module.delete = async function (key) {
		await redisClient.async.del(key);
		module.objectCache.delObjectCache(key);
	};

	module.deleteAll = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		await redisClient.async.del(keys);
		module.objectCache.delObjectCache(keys);
	};

	module.get = async function (key) {
		return await redisClient.async.get(key);
	};

	module.set = async function (key, value) {
		await redisClient.async.set(key, value);
	};

	module.increment = async function (key) {
		return await redisClient.async.incr(key);
	};

	module.rename = async function (oldKey, newKey) {
		try {
			await redisClient.async.rename(oldKey, newKey);
		} catch (err) {
			if (err && err.message !== 'ERR no such key') {
				throw err;
			}
		}

		module.objectCache.delObjectCache([oldKey, newKey]);
	};

	module.type = async function (key) {
		const type = await redisClient.async.type(key);
		return type !== 'none' ? type : null;
	};

	module.expire = async function (key, seconds) {
		await redisClient.async.expire(key, seconds);
	};

	module.expireAt = async function (key, timestamp) {
		await redisClient.async.expireat(key, timestamp);
	};

	module.pexpire = async function (key, ms) {
		await redisClient.async.pexpire(key, ms);
	};

	module.pexpireAt = async function (key, timestamp) {
		await redisClient.async.pexpireat(key, timestamp);
	};
};
