"use strict";

module.exports = function(redisClient, module) {
	module.setAdd = function(key, value, callback) {
		callback = callback || function() {};
		redisClient.sadd(key, value, function(err) {
			callback(err);
		});
	};

	module.setsAdd = function(keys, value, callback) {
		callback = callback || function() {};
		var multi = redisClient.multi();
		for (var i=0; i<keys.length; ++i) {
			multi.sadd(keys[i], value);
		}
		multi.exec(function(err) {
			callback(err);
		});
	};

	module.setRemove = function(key, value, callback) {
		redisClient.srem(key, value, callback);
	};

	module.setsRemove = function(keys, value, callback) {
		callback = callback || function() {};

		var multi = redisClient.multi();
		for(var i=0; i<keys.length; ++i) {
			multi.srem(keys[i], value);
		}
		multi.exec(function(err, res) {
			callback(err);
		});
	};

	module.isSetMember = function(key, value, callback) {
		redisClient.sismember(key, value, function(err, result) {
			if(err) {
				return callback(err);
			}

			callback(null, result === 1);
		});
	};

	module.isSetMembers = function(key, values, callback) {
		var multi = redisClient.multi();
		for (var i=0; i<values.length; ++i) {
			multi.sismember(key, values[i]);
		}

		execSetMembers(multi, callback);
	};

	module.isMemberOfSets = function(sets, value, callback) {
		var multi = redisClient.multi();
		for (var i = 0; i < sets.length; ++i) {
			multi.sismember(sets[i], value);
		}

		execSetMembers(multi, callback);
	};

	function execSetMembers(multi, callback) {
		multi.exec(function(err, results) {
			if (err) {
				return callback(err);
			}

			for (var i=0; i<results.length; ++i) {
				results[i] = results[i] === 1;
			}
			callback(null, results);
		});
	}

	module.getSetMembers = function(key, callback) {
		redisClient.smembers(key, callback);
	};

	module.getSetsMembers = function(keys, callback) {
		var multi = redisClient.multi();
		for (var i=0; i<keys.length; ++i) {
			multi.smembers(keys[i]);
		}
		multi.exec(callback);
	};

	module.setCount = function(key, callback) {
		redisClient.scard(key, callback);
	};

	module.setRemoveRandom = function(key, callback) {
		redisClient.spop(key, callback);
	};

	return module;
};