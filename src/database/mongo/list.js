'use strict';

module.exports = function (db, module) {
	var helpers = module.helpers.mongo;

	module.listPrepend = function (key, value, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		value = helpers.valueToString(value);

		module.isObjectField(key, 'array', function (err, exists) {
			if (err) {
				return callback(err);
			}

			if (exists) {
				db.collection('objects').updateOne({ _key: key }, { $push: { array: { $each: [value], $position: 0 } } }, { upsert: true, w: 1 }, function (err) {
					callback(err);
				});
			} else {
				module.listAppend(key, value, callback);
			}
		});
	};

	module.listAppend = function (key, value, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		value = helpers.valueToString(value);
		db.collection('objects').updateOne({ _key: key }, { $push: { array: value } }, { upsert: true, w: 1 }, function (err) {
			callback(err);
		});
	};

	module.listRemoveLast = function (key, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		module.getListRange(key, -1, -1, function (err, value) {
			if (err) {
				return callback(err);
			}

			db.collection('objects').updateOne({ _key: key }, { $pop: { array: 1 } }, function (err) {
				callback(err, (value && value.length) ? value[0] : null);
			});
		});
	};

	module.listRemoveAll = function (key, value, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		value = helpers.valueToString(value);

		db.collection('objects').updateOne({ _key: key }, { $pull: { array: value } }, function (err) {
			callback(err);
		});
	};

	module.listTrim = function (key, start, stop, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		module.getListRange(key, start, stop, function (err, value) {
			if (err) {
				return callback(err);
			}

			db.collection('objects').updateOne({ _key: key }, { $set: { array: value } }, function (err) {
				callback(err);
			});
		});
	};

	module.getListRange = function (key, start, stop, callback) {
		if (!key) {
			return callback();
		}

		db.collection('objects').findOne({ _key: key }, { array: 1 }, function (err, data) {
			if (err || !(data && data.array)) {
				return callback(err, []);
			}

			if (stop === -1) {
				data.array = data.array.slice(start);
			} else {
				data.array = data.array.slice(start, stop + 1);
			}
			callback(null, data.array);
		});
	};

	module.listLength = function (key, callback) {
		db.collection('objects').aggregate([
			{ $match: { _key: key } },
			{ $project: { count: { $size: '$array' } } },
		]).toArray(function (err, result) {
			callback(err, Array.isArray(result) && result.length && result[0].count);
		});
	};
};
