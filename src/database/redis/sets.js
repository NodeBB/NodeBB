'use strict';

module.exports = function (redisClient, module) {
	var helpers = require('./helpers');

	module.setAdd = async function (key, value) {
		if (!Array.isArray(value)) {
			value = [value];
		}
		if (!value.length) {
			return;
		}
		await redisClient.async.sadd(key, value);
	};

	module.setsAdd = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		const batch = redisClient.batch();
		keys.forEach(k => batch.sadd(String(k), String(value)));
		await helpers.execBatch(batch);
	};

	module.setRemove = async function (key, value) {
		if (!Array.isArray(value)) {
			value = [value];
		}
		if (!Array.isArray(key)) {
			key = [key];
		}

		var batch = redisClient.batch();
		key.forEach(k => batch.srem(String(k), value));
		await helpers.execBatch(batch);
	};

	module.setsRemove = async function (keys, value) {
		var batch = redisClient.batch();
		keys.forEach(k => batch.srem(String(k), value));
		await helpers.execBatch(batch);
	};

	module.isSetMember = function (key, value, callback) {
		redisClient.sismember(key, value, function (err, result) {
			callback(err, result === 1);
		});
	};

	module.isSetMembers = function (key, values, callback) {
		helpers.execKeyValues(redisClient, 'batch', 'sismember', key, values, function (err, results) {
			callback(err, results ? helpers.resultsToBool(results) : null);
		});
	};

	module.isMemberOfSets = function (sets, value, callback) {
		helpers.execKeysValue(redisClient, 'batch', 'sismember', sets, value, function (err, results) {
			callback(err, results ? helpers.resultsToBool(results) : null);
		});
	};

	module.getSetMembers = function (key, callback) {
		redisClient.smembers(key, callback);
	};

	module.getSetsMembers = function (keys, callback) {
		helpers.execKeys(redisClient, 'batch', 'smembers', keys, callback);
	};

	module.setCount = function (key, callback) {
		redisClient.scard(key, callback);
	};

	module.setsCount = function (keys, callback) {
		helpers.execKeys(redisClient, 'batch', 'scard', keys, callback);
	};

	module.setRemoveRandom = function (key, callback) {
		callback = callback || function () {};
		redisClient.spop(key, callback);
	};

	return module;
};
