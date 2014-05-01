"use strict";

module.exports = function(redisClient, module) {
	module.listPrepend = function(key, value, callback) {
		redisClient.lpush(key, value, callback);
	};

	module.listAppend = function(key, value, callback) {
		redisClient.rpush(key, value, callback);
	};

	module.listRemoveLast = function(key, callback) {
		redisClient.rpop(key, callback);
	};

	module.listRemoveAll = function(key, value, callback) {
		redisClient.lrem(key, 0, value, callback);
	};

	module.getListRange = function(key, start, stop, callback) {
		redisClient.lrange(key, start, stop, callback);
	};
};