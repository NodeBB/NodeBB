'use strict';

module.exports = function (redisClient, module) {
	module.listPrepend = function (key, value, callback) {
		callback = callback || function () {};
		if (!key) {
			return callback();
		}
		redisClient.lpush(key, value, function (err) {
			callback(err);
		});
	};

	module.listAppend = function (key, value, callback) {
		callback = callback || function () {};
		if (!key) {
			return callback();
		}
		redisClient.rpush(key, value, function (err) {
			callback(err);
		});
	};

	module.listRemoveLast = function (key, callback) {
		callback = callback || function () {};
		if (!key) {
			return callback();
		}
		redisClient.rpop(key, callback);
	};

	module.listRemoveAll = function (key, value, callback) {
		callback = callback || function () {};
		if (!key) {
			return callback();
		}
		redisClient.lrem(key, 0, value, function (err) {
			callback(err);
		});
	};

	module.listTrim = function (key, start, stop, callback) {
		callback = callback || function () {};
		if (!key) {
			return callback();
		}
		redisClient.ltrim(key, start, stop, function (err) {
			callback(err);
		});
	};

	module.getListRange = function (key, start, stop, callback) {
		callback = callback || function () {};
		if (!key) {
			return callback();
		}
		redisClient.lrange(key, start, stop, callback);
	};

	module.listLength = function (key, callback) {
		redisClient.llen(key, callback);
	};
};
