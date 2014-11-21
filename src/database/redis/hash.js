"use strict";

module.exports = function(redisClient, module) {
	module.setObject = function(key, data, callback) {
		callback = callback || function() {};
		redisClient.hmset(key, data, function(err) {
			callback(err);
		});
	};

	module.setObjectField = function(key, field, value, callback) {
		callback = callback || function() {};
		redisClient.hset(key, field, value, callback);
	};

	module.getObject = function(key, callback) {
		redisClient.hgetall(key, callback);
	};

	module.getObjects = function(keys, callback) {
		var	multi = redisClient.multi();

		for(var x=0; x<keys.length; ++x) {
			multi.hgetall(keys[x]);
		}

		multi.exec(callback);
	};

	module.getObjectField = function(key, field, callback) {
		module.getObjectFields(key, [field], function(err, data) {
			if(err) {
				return callback(err);
			}

			callback(null, data[field]);
		});
	};

	module.getObjectFields = function(key, fields, callback) {
		module.getObjectsFields([key], fields, function(err, results) {
			callback(err, results ? results[0]: null);
		});
	};

	module.getObjectsFields = function(keys, fields, callback) {
		if (!Array.isArray(fields) || !fields.length) {
			return callback(null, keys.map(function() { return {}; }));
		}
		var	multi = redisClient.multi();

		for(var x=0; x<keys.length; ++x) {
			multi.hmget.apply(multi, [keys[x]].concat(fields));
		}

		function makeObject(array) {
			var obj = {};

			for (var i = 0, ii = fields.length; i < ii; ++i) {
				obj[fields[i]] = array[i];
			}
			return obj;
		}

		multi.exec(function(err, results) {
			if (err) {
				return callback(err);
			}

			results = results.map(makeObject);
			callback(null, results);
		});
	};

	module.getObjectKeys = function(key, callback) {
		redisClient.hkeys(key, callback);
	};

	module.getObjectValues = function(key, callback) {
		redisClient.hvals(key, callback);
	};

	module.isObjectField = function(key, field, callback) {
		redisClient.hexists(key, field, function(err, exists) {
			callback(err, exists === 1);
		});
	};

	module.deleteObjectField = function(key, field, callback) {
		redisClient.hdel(key, field, callback);
	};

	module.incrObjectField = function(key, field, callback) {
		redisClient.hincrby(key, field, 1, callback);
	};

	module.decrObjectField = function(key, field, callback) {
		redisClient.hincrby(key, field, -1, callback);
	};

	module.incrObjectFieldBy = function(key, field, value, callback) {
		redisClient.hincrby(key, field, value, callback);
	};
};