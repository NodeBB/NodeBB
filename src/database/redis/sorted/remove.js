
'use strict';

module.exports = function (redisClient, module) {
	var helpers = module.helpers.redis;

	module.sortedSetRemove = async function (key, value) {
		if (!value) {
			return;
		}
		if (!Array.isArray(value)) {
			value = [value];
		}

		const batch = redisClient.batch();
		if (Array.isArray(key)) {
			key.forEach(k => batch.zrem(k, value));
		} else {
			batch.zrem(key, value);
		}
		await helpers.execBatch(batch);
	};

	module.sortedSetsRemove = async function (keys, value) {
		await module.sortedSetRemove(keys, value);
	};

	module.sortedSetsRemoveRangeByScore = async function (keys, min, max) {
		var batch = redisClient.batch();
		keys.forEach(k => batch.zremrangebyscore(k, min, max));
		await helpers.execBatch(batch);
	};
};
