'use strict';

module.exports = function (redisClient, module) {
	var helpers = module.helpers.redis;

	module.setAdd = function (key, value, callback) {
		callback = callback || function () {};
		if (!Array.isArray(value)) {
			value = [value];
		}
		if (!value.length) {
			return callback();
		}
		redisClient.sadd(key, value, function (err) {
			callback(err);
		});
	};

	module.setsAdd = function (keys, value, callback) {
		callback = callback || function () {};
		helpers.multiKeysValue(redisClient, 'sadd', keys, value, function (err) {
			callback(err);
		});
	};

	module.setRemove = function (key, value, callback) {
		callback = callback || function () {};
		if (!Array.isArray(value)) {
			value = [value];
		}
		if (!Array.isArray(key)) {
			key = [key];
		}
		var multi = redisClient.multi();
		key.forEach(function (key) {
			multi.srem(key, value);
		});
		multi.exec(function (err) {
			callback(err);
		});
	};

	module.setsRemove = function (keys, value, callback) {
		callback = callback || function () {};
		helpers.multiKeysValue(redisClient, 'srem', keys, value, function (err) {
			callback(err);
		});
	};

	module.isSetMember = function (key, value, callback) {
		redisClient.sismember(key, value, function (err, result) {
			callback(err, result === 1);
		});
	};

	module.isSetMembers = function (key, values, callback) {
		helpers.multiKeyValues(redisClient, 'sismember', key, values, function (err, results) {
			callback(err, results ? helpers.resultsToBool(results) : null);
		});
	};

	module.isMemberOfSets = function (sets, value, callback) {
		helpers.multiKeysValue(redisClient, 'sismember', sets, value, function (err, results) {
			callback(err, results ? helpers.resultsToBool(results) : null);
		});
	};

	module.getSetMembers = function (key, callback) {
		redisClient.smembers(key, callback);
	};

	module.getSetsMembers = function (keys, callback) {
		helpers.multiKeys(redisClient, 'smembers', keys, callback);
	};

	module.setCount = function (key, callback) {
		redisClient.scard(key, callback);
	};

	module.setsCount = function (keys, callback) {
		helpers.multiKeys(redisClient, 'scard', keys, callback);
	};

	module.setRemoveRandom = function (key, callback) {
		callback = callback || function () {};
		redisClient.spop(key, callback);
	};

	return module;
};
