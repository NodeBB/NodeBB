'use strict';

module.exports = function (redisClient, module) {
	var helpers = module.helpers.redis;

	module.setObject = function (key, data, callback) {
		callback = callback || function () {};
		if (!key || !data) {
			return callback();
		}

		if (data.hasOwnProperty('')) {
			delete data[''];
		}

		Object.keys(data).forEach(function (key) {
			if (data[key] === undefined || data[key] === null) {
				delete data[key];
			}
		});

		redisClient.hmset(key, data, function (err) {
			callback(err);
		});
	};

	module.setObjectField = function (key, field, value, callback) {
		callback = callback || function () {};
		if (!field) {
			return callback();
		}
		redisClient.hset(key, field, value, function (err) {
			callback(err);
		});
	};

	module.getObject = function (key, callback) {
		redisClient.hgetall(key, callback);
	};

	module.getObjects = function (keys, callback) {
		helpers.multiKeys(redisClient, 'hgetall', keys, callback);
	};

	module.getObjectField = function (key, field, callback) {
		module.getObjectFields(key, [field], function (err, data) {
			callback(err, data ? data[field] : null);
		});
	};

	module.getObjectFields = function (key, fields, callback) {
		module.getObjectsFields([key], fields, function (err, results) {
			callback(err, results ? results[0] : null);
		});
	};

	module.getObjectsFields = function (keys, fields, callback) {
		if (!Array.isArray(fields) || !fields.length) {
			return callback(null, keys.map(function () { return {}; }));
		}
		var multi = redisClient.multi();

		for (var x = 0; x < keys.length; x += 1) {
			multi.hmget.apply(multi, [keys[x]].concat(fields));
		}

		function makeObject(array) {
			var obj = {};

			for (var i = 0, ii = fields.length; i < ii; i += 1) {
				obj[fields[i]] = array[i];
			}
			return obj;
		}

		multi.exec(function (err, results) {
			if (err) {
				return callback(err);
			}

			results = results.map(makeObject);
			callback(null, results);
		});
	};

	module.getObjectKeys = function (key, callback) {
		redisClient.hkeys(key, callback);
	};

	module.getObjectValues = function (key, callback) {
		redisClient.hvals(key, callback);
	};

	module.isObjectField = function (key, field, callback) {
		redisClient.hexists(key, field, function (err, exists) {
			callback(err, exists === 1);
		});
	};

	module.isObjectFields = function (key, fields, callback) {
		helpers.multiKeyValues(redisClient, 'hexists', key, fields, function (err, results) {
			callback(err, Array.isArray(results) ? helpers.resultsToBool(results) : null);
		});
	};

	module.deleteObjectField = function (key, field, callback) {
		callback = callback || function () {};
		if (key === undefined || key === null || field === undefined || field === null) {
			return setImmediate(callback);
		}
		redisClient.hdel(key, field, function (err) {
			callback(err);
		});
	};

	module.deleteObjectFields = function (key, fields, callback) {
		helpers.multiKeyValues(redisClient, 'hdel', key, fields, function (err) {
			callback(err);
		});
	};

	module.incrObjectField = function (key, field, callback) {
		module.incrObjectFieldBy(key, field, 1, callback);
	};

	module.decrObjectField = function (key, field, callback) {
		module.incrObjectFieldBy(key, field, -1, callback);
	};

	module.incrObjectFieldBy = function (key, field, value, callback) {
		value = parseInt(value, 10);
		if (!key || isNaN(value)) {
			return callback(null, null);
		}
		if (Array.isArray(key)) {
			var multi = redisClient.multi();
			key.forEach(function (key) {
				multi.hincrby(key, field, value);
			});
			multi.exec(callback);
		} else {
			redisClient.hincrby(key, field, value, callback);
		}
	};
};
