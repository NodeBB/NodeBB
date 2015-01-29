"use strict";

module.exports = function(redisClient, module) {
	module.searchIndex = function(key, content, id, callback) {
		if (key === 'post') {
			module.postSearch.index(content, id, callback);
		} else if(key === 'topic') {
			module.topicSearch.index(content, id, callback);
		}
	};

	module.search = function(key, term, limit, callback) {
		function search(searchObj, callback) {
			searchObj
				.query(term)
				.between(0, limit - 1)
				.type('or')
				.end(callback);
		}

		if(key === 'post') {
			search(module.postSearch, callback);
		} else if(key === 'topic') {
			search(module.topicSearch, callback);
		}
	};

	module.searchRemove = function(key, id, callback) {
		if(key === 'post') {
			module.postSearch.remove(id, callback);
		} else if(key === 'topic') {
			module.topicSearch.remove(id, callback);
		}
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
		redisClient.exists(oldKey, function(err, exists) {
			if (err || !exists) {
				return callback(err);
			}
			redisClient.rename(oldKey, newKey, function(err, res) {
				callback(err);
			});
		});
	};

	module.expire = function(key, seconds, callback) {
		redisClient.expire(key, seconds, callback);
	};

	module.expireAt = function(key, timestamp, callback) {
		redisClient.expireat(key, timestamp, callback);
	};

	module.pexpire = function(key, ms, callback) {
		redisClient.pexpire(key, ms, callback);
	};

	module.pexpireAt = function(key, timestamp, callback) {
		redisClient.pexpireat(key, timestamp, callback);
	};
};
