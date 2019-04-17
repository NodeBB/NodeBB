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

		if (!Object.keys(data).length) {
			return callback();
		}
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
		if (!Array.isArray(keys) || !keys.length) {
			return setImmediate(callback, null, []);
		}
		if (keys.length > 1) {
			helpers.execKeys(redisClient, 'batch', 'hgetall', keys, callback);
		} else {
			redisClient.hgetall(keys[0], (err, data) => callback(err, [data]));
		}
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
		var batch = redisClient.batch();

		for (var x = 0; x < keys.length; x += 1) {
			batch.hmget.apply(batch, [keys[x]].concat(fields));
		}

		batch.exec(function (err, results) {
			if (err) {
				return callback(err);
			}

			results = results.map(function makeObject(array) {
				var obj = {};
				for (var i = 0, ii = fields.length; i < ii; i += 1) {
					obj[fields[i]] = array[i];
				}
				return obj;
			});
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
		helpers.execKeyValues(redisClient, 'batch', 'hexists', key, fields, function (err, results) {
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
		helpers.execKeyValues(redisClient, 'batch', 'hdel', key, fields, function (err) {
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
		callback = callback || helpers.noop;
		function done(err, result) {
			if (err) {
				return callback(err);
			}
			callback(null, Array.isArray(result) ? result.map(value => parseInt(value, 10)) : parseInt(result, 10));
		}
		value = parseInt(value, 10);
		if (!key || isNaN(value)) {
			return callback(null, null);
		}
		if (Array.isArray(key)) {
			var batch = redisClient.batch();
			key.forEach(function (key) {
				batch.hincrby(key, field, value);
			});
			batch.exec(done);
		} else {
			redisClient.hincrby(key, field, value, done);
		}
	};
};
