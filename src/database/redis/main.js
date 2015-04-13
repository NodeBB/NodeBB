"use strict";

module.exports = function(redisClient, module) {
	module.searchIndex = function(key, data, id, callback) {
		var method = key === 'post' ? module.postSearch : module.topicSearch;

		method.index(data, id, function(err, res) {
			callback(err);
		});
	};

	module.search = function(key, data, limit, callback) {
		var method = key === 'post' ? module.postSearch : module.topicSearch;

		method.query(data, 0, limit - 1, callback);
	};

	module.searchRemove = function(key, id, callback) {
		callback = callback || function() {};
		if (!id) {
			return callback();
		}
		var method = key === 'post' ? module.postSearch : module.topicSearch;

		method.remove(id, function(err, res) {
			callback(err);
		});
	};

	module.flushdb = function(callback) {
		redisClient.send_command('flushdb', [], function(err) {
			if (typeof callback === 'function') {
				callback(err);
			}
		});
	};

	module.info = function(callback) {
		redisClient.info(function (err, data) {
			if(err) {
				return callback(err);
			}

			var lines = data.toString().split("\r\n").sort();
			var redisData = {};
			lines.forEach(function (line) {
				var parts = line.split(':');
				if (parts[1]) {
					redisData[parts[0]] = parts[1];
				}
			});

			redisData.raw = JSON.stringify(redisData, null, 4);
			redisData.redis = true;

			callback(null, redisData);
		});
	};

	module.exists = function(key, callback) {
		redisClient.exists(key, function(err, exists) {
			callback(err, exists === 1);
		});
	};

	module.delete = function(key, callback) {
		callback = callback || function() {};
		redisClient.del(key, function(err, res) {
			callback(err);
		});
	};

	module.deleteAll = function(keys, callback) {
		callback = callback || function() {};
		var multi = redisClient.multi();
		for(var i=0; i<keys.length; ++i) {
			multi.del(keys[i]);
		}
		multi.exec(function(err, res) {
			callback(err);
		});
	};

	module.get = function(key, callback) {
		redisClient.get(key, callback);
	};

	module.set = function(key, value, callback) {
		callback = callback || function() {};
		redisClient.set(key, value, function(err) {
			callback(err);
		});
	};

	module.increment = function(key, callback) {
		callback = callback || function() {};
		redisClient.incr(key, callback);
	};

	module.rename = function(oldKey, newKey, callback) {
		callback = callback || function() {};
		redisClient.rename(oldKey, newKey, function(err, res) {
			callback(err && err.message !== 'ERR no such key' ? err : null);
		});
	};

	module.expire = function(key, seconds, callback) {
		redisClient.expire(key, seconds, function(err) {
			callback(err);
		});
	};

	module.expireAt = function(key, timestamp, callback) {
		redisClient.expireat(key, timestamp, function(err) {
			callback(err);
		});
	};

	module.pexpire = function(key, ms, callback) {
		redisClient.pexpire(key, ms, function(err) {
			callback(err);
		});
	};

	module.pexpireAt = function(key, timestamp, callback) {
		redisClient.pexpireat(key, timestamp, function(err) {
			callback(err);
		});
	};
};
