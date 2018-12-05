
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
			var batch = redisClient.batch();
			key.forEach(function (key) {
				batch.zrem(key, value);
			});
			batch.exec(function (err) {
				callback(err);
			});
		} else {
			helpers.execKeyValues(redisClient, 'batch', 'zrem', key, value, function (err) {
				callback(err);
			});
		}
	};

	module.sortedSetsRemove = function (keys, value, callback) {
		helpers.execKeysValue(redisClient, 'batch', 'zrem', keys, value, function (err) {
			callback(err);
		});
	};

	module.sortedSetsRemoveRangeByScore = function (keys, min, max, callback) {
		callback = callback || function () {};
		var batch = redisClient.batch();
		for (var i = 0; i < keys.length; i += 1) {
			batch.zremrangebyscore(keys[i], min, max);
		}
		batch.exec(function (err) {
			callback(err);
		});
	};
};
