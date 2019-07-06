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

	module.type = function (key, callback) {
		redisClient.type(key, function (err, type) {
			callback(err, type !== 'none' ? type : null);
		});
	};

	module.expire = function (key, seconds, callback) {
		callback = callback || function () {};
		redisClient.expire(key, seconds, function (err) {
			callback(err);
		});
	};

	module.expireAt = function (key, timestamp, callback) {
		callback = callback || function () {};
		redisClient.expireat(key, timestamp, function (err) {
			callback(err);
		});
	};

	module.pexpire = function (key, ms, callback) {
		callback = callback || function () {};
		redisClient.pexpire(key, ms, function (err) {
			callback(err);
		});
	};

	module.pexpireAt = function (key, timestamp, callback) {
		callback = callback || function () {};
		redisClient.pexpireat(key, timestamp, function (err) {
			callback(err);
		});
	};
};
