'use strict';

module.exports = function (redisClient, module) {
	module.listPrepend = async function (key, value) {
		if (!key) {
			return;
		}
		await redisClient.async.lpush(key, value);
	};

	module.listAppend = async function (key, value) {
		if (!key) {
			return;
		}
		await redisClient.async.rpush(key, value);
	};

	module.listRemoveLast = async function (key) {
		if (!key) {
			return;
		}
		return await redisClient.async.rpop(key);
	};

	module.listRemoveAll = async function (key, value) {
		if (!key) {
			return;
		}
		await redisClient.async.lrem(key, 0, value);
	};

	module.listTrim = async function (key, start, stop) {
		if (!key) {
			return;
		}
		await redisClient.async.ltrim(key, start, stop);
	};

	module.getListRange = async function (key, start, stop) {
		if (!key) {
			return;
		}
		return await redisClient.async.lrange(key, start, stop);
	};

	module.listLength = async function (key) {
		return await redisClient.async.llen(key);
	};
};
