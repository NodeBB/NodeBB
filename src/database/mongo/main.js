'use strict';

module.exports = function (db, module) {
	var helpers = module.helpers.mongo;

	module.flushdb = function (callback) {
		callback = callback || helpers.noop;
		db.dropDatabase(function (err) {
			callback(err);
		});
	};

	module.emptydb = function (callback) {
		callback = callback || helpers.noop;
		db.collection('objects').deleteMany({}, function (err) {
			if (err) {
				return callback(err);
			}
			module.objectCache.resetObjectCache();
			callback();
		});
	};

	module.exists = function (key, callback) {
		if (!key) {
			return callback();
		}
		if (Array.isArray(key)) {
			db.collection('objects').find({ _key: { $in: key } }).toArray(function (err, data) {
				if (err) {
					return callback(err);
				}

				var map = {};
				data.forEach(function (item) {
					map[item._key] = true;
				});

				callback(null, key.map(key => !!map[key]));
			});
		} else {
			db.collection('objects').findOne({ _key: key }, function (err, item) {
				callback(err, item !== undefined && item !== null);
			});
		}
	};

	module.delete = function (key, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		db.collection('objects').deleteMany({ _key: key }, function (err) {
			if (err) {
				return callback(err);
			}
			module.objectCache.delObjectCache(key);
			callback();
		});
	};

	module.deleteAll = function (keys, callback) {
		callback = callback || helpers.noop;
		if (!Array.isArray(keys) || !keys.length) {
			return callback();
		}
		db.collection('objects').deleteMany({ _key: { $in: keys } }, function (err) {
			if (err) {
				return callback(err);
			}

			module.objectCache.delObjectCache(keys);

			callback(null);
		});
	};

	module.get = function (key, callback) {
		if (!key) {
			return callback();
		}

		db.collection('objects').findOne({ _key: key }, { projection: { _id: 0 } }, function (err, objectData) {
			if (err) {
				return callback(err);
			}
			// fallback to old field name 'value' for backwards compatibility #6340
			var value = null;
			if (objectData) {
				if (objectData.hasOwnProperty('data')) {
					value = objectData.data;
				} else if (objectData.hasOwnProperty('value')) {
					value = objectData.value;
				}
			}
			callback(null, value);
		});
	};

	module.set = function (key, value, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		var data = { data: value };
		module.setObject(key, data, callback);
	};

	module.increment = function (key, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		db.collection('objects').findOneAndUpdate({ _key: key }, { $inc: { data: 1 } }, { returnOriginal: false, upsert: true }, function (err, result) {
			callback(err, result && result.value ? result.value.data : null);
		});
	};

	module.rename = function (oldKey, newKey, callback) {
		callback = callback || helpers.noop;
		db.collection('objects').updateMany({ _key: oldKey }, { $set: { _key: newKey } }, function (err) {
			if (err) {
				return callback(err);
			}
			module.objectCache.delObjectCache(oldKey);
			module.objectCache.delObjectCache(newKey);
			callback();
		});
	};

	module.type = function (key, callback) {
		db.collection('objects').findOne({ _key: key }, function (err, data) {
			if (err) {
				return callback(err);
			}
			if (!data) {
				return callback(null, null);
			}
			delete data.expireAt;
			var keys = Object.keys(data);
			if (keys.length === 4 && data.hasOwnProperty('_key') && data.hasOwnProperty('score') && data.hasOwnProperty('value')) {
				return callback(null, 'zset');
			} else if (keys.length === 3 && data.hasOwnProperty('_key') && data.hasOwnProperty('members')) {
				return callback(null, 'set');
			} else if (keys.length === 3 && data.hasOwnProperty('_key') && data.hasOwnProperty('array')) {
				return callback(null, 'list');
			} else if (keys.length === 3 && data.hasOwnProperty('_key') && data.hasOwnProperty('data')) {
				return callback(null, 'string');
			}
			callback(null, 'hash');
		});
	};

	module.expire = function (key, seconds, callback) {
		module.expireAt(key, Math.round(Date.now() / 1000) + seconds, callback);
	};

	module.expireAt = function (key, timestamp, callback) {
		module.setObjectField(key, 'expireAt', new Date(timestamp * 1000), callback);
	};

	module.pexpire = function (key, ms, callback) {
		module.pexpireAt(key, Date.now() + parseInt(ms, 10), callback);
	};

	module.pexpireAt = function (key, timestamp, callback) {
		timestamp = Math.min(timestamp, 8640000000000000);
		module.setObjectField(key, 'expireAt', new Date(timestamp), callback);
	};
};
