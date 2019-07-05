
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

		if (Array.isArray(key)) {
			const batch = redisClient.batch();
			key.forEach(k => batch.zrem(k, value));
			await helpers.execBatch(batch);
		} else {
			const batch = redisClient.batch();
			value.forEach(v => batch.zrem(key, v));
			await helpers.execBatch(batch);
		}
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
