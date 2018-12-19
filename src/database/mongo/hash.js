'use strict';

var async = require('async');


module.exports = function (db, module) {
	var helpers = module.helpers.mongo;

	var _ = require('lodash');
	const cache = require('../cache').create('mongo');

	module.objectCache = cache;

	module.setObject = function (key, data, callback) {
		callback = callback || helpers.noop;
		if (!key || !data) {
			return callback();
		}

		const writeData = helpers.serializeData(data);
		db.collection('objects').updateOne({ _key: key }, { $set: writeData }, { upsert: true, w: 1 }, function (err) {
			if (err) {
				return callback(err);
			}
			cache.delObjectCache(key);
			callback();
		});
	};

	module.setObjectField = function (key, field, value, callback) {
		callback = callback || helpers.noop;
		if (!field) {
			return callback();
		}
		var data = {};
		data[field] = value;
		module.setObject(key, data, callback);
	};

	module.getObject = function (key, callback) {
		if (!key) {
			return callback();
		}

		module.getObjects([key], function (err, data) {
			if (err) {
				return callback(err);
			}
			callback(null, data && data.length ? data[0] : null);
		});
	};

	module.getObjects = function (keys, callback) {
		var cachedData = {};
		function getFromCache() {
			process.nextTick(callback, null, keys.map(key => _.clone(cachedData[key])));
		}

		if (!Array.isArray(keys) || !keys.length) {
			return callback(null, []);
		}

		const unCachedKeys = cache.getUnCachedKeys(keys, cachedData);

		if (!unCachedKeys.length) {
			return getFromCache();
		}

		var query = { _key: { $in: unCachedKeys } };
		if (unCachedKeys.length === 1) {
			query._key = unCachedKeys[0];
		}
		db.collection('objects').find(query, { projection: { _id: 0 } }).toArray(function (err, data) {
			if (err) {
				return callback(err);
			}
			data = data.map(helpers.deserializeData);
			var map = helpers.toMap(data);
			unCachedKeys.forEach(function (key) {
				cachedData[key] = map[key] || null;
				cache.set(key, cachedData[key]);
			});

			getFromCache();
		});
	};

	module.getObjectField = function (key, field, callback) {
		if (!key) {
			return callback();
		}
		module.getObject(key, function (err, item) {
			if (err || !item) {
				return callback(err, null);
			}
			callback(null, item.hasOwnProperty(field) ? item[field] : null);
		});
	};

	module.getObjectFields = function (key, fields, callback) {
		if (!key) {
			return callback();
		}
		module.getObjectsFields([key], fields, function (err, data) {
			callback(err, data ? data[0] : null);
		});
	};

	module.getObjectsFields = function (keys, fields, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback(null, []);
		}
		module.getObjects(keys, function (err, items) {
			if (err) {
				return callback(err);
			}
			if (items === null) {
				items = [];
			}

			const returnData = items.map((item) => {
				item = item || {};
				const result = {};
				fields.forEach((field) => {
					result[field] = item[field] !== undefined ? item[field] : null;
				});
				return result;
			});

			callback(null, returnData);
		});
	};

	module.getObjectKeys = function (key, callback) {
		module.getObject(key, function (err, data) {
			callback(err, data ? Object.keys(data) : []);
		});
	};

	module.getObjectValues = function (key, callback) {
		module.getObject(key, function (err, data) {
			if (err) {
				return callback(err);
			}

			var values = [];
			for (var key in data) {
				if (data && data.hasOwnProperty(key)) {
					values.push(data[key]);
				}
			}
			callback(null, values);
		});
	};

	module.isObjectField = function (key, field, callback) {
		if (!key) {
			return callback();
		}
		var data = {};
		field = helpers.fieldToString(field);
		data[field] = 1;
		db.collection('objects').findOne({ _key: key }, { projection: data }, function (err, item) {
			callback(err, !!item && item[field] !== undefined && item[field] !== null);
		});
	};

	module.isObjectFields = function (key, fields, callback) {
		if (!key) {
			return callback();
		}

		var data = {};
		fields.forEach(function (field) {
			field = helpers.fieldToString(field);
			data[field] = 1;
		});

		db.collection('objects').findOne({ _key: key }, { projection: data }, function (err, item) {
			if (err) {
				return callback(err);
			}
			var results = [];

			fields.forEach(function (field, index) {
				results[index] = !!item && item[field] !== undefined && item[field] !== null;
			});

			callback(null, results);
		});
	};

	module.deleteObjectField = function (key, field, callback) {
		module.deleteObjectFields(key, [field], callback);
	};

	module.deleteObjectFields = function (key, fields, callback) {
		callback = callback || helpers.noop;
		if (!key || !Array.isArray(fields) || !fields.length) {
			return callback();
		}
		fields = fields.filter(Boolean);
		if (!fields.length) {
			return callback();
		}

		var data = {};
		fields.forEach(function (field) {
			field = helpers.fieldToString(field);
			data[field] = '';
		});

		db.collection('objects').updateOne({ _key: key }, { $unset: data }, function (err) {
			if (err) {
				return callback(err);
			}
			cache.delObjectCache(key);
			callback();
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
		value = parseInt(value, 10);
		if (!key || isNaN(value)) {
			return callback(null, null);
		}

		var data = {};
		field = helpers.fieldToString(field);
		data[field] = value;

		if (Array.isArray(key)) {
			var bulk = db.collection('objects').initializeUnorderedBulkOp();
			key.forEach(function (key) {
				bulk.find({ _key: key }).upsert().update({ $inc: data });
			});

			async.waterfall([
				function (next) {
					bulk.execute(function (err) {
						next(err);
					});
				},
				function (next) {
					cache.delObjectCache(key);

					module.getObjectsFields(key, [field], next);
				},
				function (data, next) {
					data = data.map(function (data) {
						return data && data[field];
					});
					next(null, data);
				},
			], callback);
			return;
		}


		db.collection('objects').findOneAndUpdate({ _key: key }, { $inc: data }, { returnOriginal: false, upsert: true }, function (err, result) {
			if (err) {
				return callback(err);
			}
			cache.delObjectCache(key);
			callback(null, result && result.value ? result.value[field] : null);
		});
	};
};
