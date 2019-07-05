'use strict';

var async = require('async');


module.exports = function (db, module) {
	var helpers = module.helpers.mongo;

	var _ = require('lodash');
	const cache = require('../cache').create('mongo');

	module.objectCache = cache;

	module.setObject = async function (key, data) {
		if (!key || !data) {
			return;
		}

		const writeData = helpers.serializeData(data);
		await db.collection('objects').updateOne({ _key: key }, { $set: writeData }, { upsert: true, w: 1 });
		cache.delObjectCache(key);
	};

	module.setObjectField = async function (key, field, value) {
		if (!field) {
			return;
		}
		var data = {};
		data[field] = value;
		await module.setObject(key, data);
	};

	module.getObject = async function (key) {
		if (!key) {
			return null;
		}

		const data = await module.getObjects([key]);
		return data && data.length ? data[0] : null;
	};

	module.getObjects = async function (keys) {
		return await module.getObjectsFields(keys, []);
	};

	module.getObjectField = async function (key, field) {
		if (!key) {
			return null;
		}
		const cachedData = {};
		cache.getUnCachedKeys([key], cachedData);
		if (cachedData[key]) {
			return cachedData[key].hasOwnProperty(field) ? cachedData[key][field] : null;
		}
		field = helpers.fieldToString(field);
		const item = await db.collection('objects').findOne({ _key: key }, { projection: { _id: 0, [field]: 1 } });
		if (!item) {
			return null;
		}
		return item.hasOwnProperty(field) ? item[field] : null;
	};

	module.getObjectFields = async function (key, fields) {
		if (!key) {
			return null;
		}
		const data = await module.getObjectsFields([key], fields);
		return data ? data[0] : null;
	};

	module.getObjectsFields = async function (keys, fields) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const cachedData = {};
		function returnData() {
			var mapped = keys.map(function (key) {
				if (!fields.length) {
					return _.clone(cachedData[key]);
				}

				const item = cachedData[key] || {};
				const result = {};
				fields.forEach((field) => {
					result[field] = item[field] !== undefined ? item[field] : null;
				});
				return result;
			});

			return mapped;
		}

		const unCachedKeys = cache.getUnCachedKeys(keys, cachedData);
		if (!unCachedKeys.length) {
			return returnData();
		}

		var query = { _key: { $in: unCachedKeys } };
		if (unCachedKeys.length === 1) {
			query._key = unCachedKeys[0];
		}
		let data = await db.collection('objects').find(query, { projection: { _id: 0 } }).toArray();

		data = data.map(helpers.deserializeData);
		var map = helpers.toMap(data);
		unCachedKeys.forEach(function (key) {
			cachedData[key] = map[key] || null;
			cache.set(key, cachedData[key]);
		});

		return returnData();
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
