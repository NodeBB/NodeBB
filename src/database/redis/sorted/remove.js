
'use strict';

module.exports = function (redisClient, module) {
	var helpers = module.helpers.redis;

	module.sortedSetRemove = function (key, value, callback) {
		callback = callback || function () {};
		if (!value) {
			return callback();
		}
		if (!Array.isArray(value)) {
			value = [value];
		}

		if (Array.isArray(key)) {
			var multi = redisClient.multi();
			key.forEach(function (key) {
				multi.zrem(key, value);
			});
			multi.exec(function (err) {
				callback(err);
			});
		} else {
			helpers.multiKeyValues(redisClient, 'zrem', key, value, function (err) {
				callback(err);
			});
		}
	};

	module.sortedSetsRemove = function (keys, value, callback) {
		helpers.multiKeysValue(redisClient, 'zrem', keys, value, function (err) {
			callback(err);
		});
	};

	module.sortedSetsRemoveRangeByScore = function (keys, min, max, callback) {
		callback = callback || function () {};
		var multi = redisClient.multi();
		for (var i = 0; i < keys.length; i += 1) {
			multi.zremrangebyscore(keys[i], min, max);
		}
		multi.exec(function (err) {
			callback(err);
		});
	};
};
