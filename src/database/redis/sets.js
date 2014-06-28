"use strict";

module.exports = function(redisClient, module) {
	module.setAdd = function(key, value, callback) {
		redisClient.sadd(key, value, callback);
	};

	module.setRemove = function(key, value, callback) {
		redisClient.srem(key, value, callback);
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

		multi.exec(function(err, results) {
			if (err) {
				return callback(err);
			}

			for (var i=0; i<results.length; ++i) {
				results[i] = results[i] === 1;
			}
			callback(null, results);
		});
	};

	module.isMemberOfSets = function(sets, value, callback) {
		var multi = redisClient.multi();

		for (var i = 0; i < sets.length; ++i) {
			multi.sismember(sets[i], value);
		}

		multi.exec(function(err, results) {
			if (err) {
				return callback(err);
			}

			for (var i=0; i<results.length; ++i) {
				results[i] = results[i] === 1;
			}
			callback(null, results);
		});
	};

	module.getSetMembers = function(key, callback) {
		redisClient.smembers(key, callback);
	};

	module.setCount = function(key, callback) {
		redisClient.scard(key, callback);
	};

	module.setRemoveRandom = function(key, callback) {
		redisClient.spop(key, callback);
	};

	return module;
};