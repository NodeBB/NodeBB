'use strict';

module.exports = function (redisClient, module) {
	var helpers = module.helpers.redis;

	module.flushdb = function (callback) {
		redisClient.send_command('flushdb', [], function (err) {
			if (typeof callback === 'function') {
				callback(err);
			}
		});
	};

	module.emptydb = function (callback) {
		module.flushdb(function (err) {
			if (err) {
				return callback(err);
			}
			callback();
		});
	};

	module.exists = function (key, callback) {
		if (Array.isArray(key)) {
			helpers.execKeys(redisClient, 'batch', 'exists', key, function (err, data) {
				callback(err, data && data.map(exists => exists === 1));
			});
		} else {
			redisClient.exists(key, function (err, exists) {
				callback(err, exists === 1);
			});
		}
	};

	module.delete = function (key, callback) {
		callback = callback || function () {};
		redisClient.del(key, function (err) {
			callback(err);
		});
	};

	module.deleteAll = function (keys, callback) {
		callback = callback || function () {};
		var batch = redisClient.batch();
		for (var i = 0; i < keys.length; i += 1) {
			batch.del(keys[i]);
		}
		batch.exec(function (err) {
			callback(err);
		});
	};

	module.get = function (key, callback) {
		redisClient.get(key, callback);
	};

	module.set = function (key, value, callback) {
		callback = callback || function () {};
		redisClient.set(key, value, function (err) {
			callback(err);
		});
	};

	module.increment = function (key, callback) {
		callback = callback || function () {};
		redisClient.incr(key, callback);
	};

	module.rename = function (oldKey, newKey, callback) {
		callback = callback || function () {};
		redisClient.rename(oldKey, newKey, function (err) {
			if (err && err.message !== 'ERR no such key') {
				return callback(err);
			}
			callback();
		});
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
