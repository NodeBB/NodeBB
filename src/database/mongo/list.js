"use strict";

module.exports = function(db, module) {
	var helpers = module.helpers.mongo;

	module.listPrepend = function(key, value, callback) {
		callback = callback || helpers.noop;

		if (!key) {
			return callback();
		}

		value = helpers.valueToString(value);

		module.isObjectField(key, 'array', function(err, exists) {
			if (err) {
				return callback(err);
			}

			if (exists) {
				db.collection('objects').update({_key:key}, {$push: {array: {$each: [value], $position: 0}}}, {upsert:true, w:1 }, callback);
			} else {
				module.listAppend(key, value, callback);
			}
		});
	};

	module.listAppend = function(key, value, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		value = helpers.valueToString(value);
		db.collection('objects').update({ _key: key }, { $push: { array: value } }, {upsert:true, w:1}, callback);
	};

	module.listRemoveLast = function(key, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		module.getListRange(key, -1, 0, function(err, value) {
			if (err) {
				return callback(err);
			}

			db.collection('objects').update({_key: key }, { $pop: { array: 1 } }, function(err, result) {
				callback(err, (value && value.length) ? value[0] : null);
			});
		});
	};

	module.listTrim = function(key, start, stop, callback) {
		callback = callback || helpers.noop;
		if (!key) {
			return callback();
		}
		module.getListRange(key, start, stop, function(err, value) {
			if (err) {
				return callback(err);
			}

			db.collection('objects').update({_key: key}, {$set: {array: value}}, callback);
		});
	};

	module.listRemoveAll = function(key, value, callback) {
		callback =  callback || helpers.noop;
		if (!key) {
			return callback();
		}
		value = helpers.valueToString(value);

		db.collection('objects').update({_key: key }, { $pull: { array: value } }, callback);
	};

	module.getListRange = function(key, start, stop, callback) {
		if (!key) {
			return callback();
		}
		var skip = start,
			limit = stop - start + 1,
			splice = false;

		if((start < 0 && stop >= 0) || (start >= 0 && stop < 0)) {
			skip = 0;
			limit = Math.pow(2, 31) - 2;
			splice = true;
		} else if (start > stop) {
			return callback(null, []);
		}

		db.collection('objects').findOne({_key:key}, { array: { $slice: [skip, limit] }}, function(err, data) {
			if(err || !(data && data.array)) {
				return callback(err, []);
			}

			if(splice) {

				if(start < 0) {
					start = data.array.length - Math.abs(start);
				}

				if(stop < 0) {
					stop = data.array.length - Math.abs(stop);
				}

				if(start > stop) {
					return callback(null, []);
				}

				var howMany = stop - start + 1;
				if(start !== 0 || howMany !== data.array.length) {
					data.array = data.array.splice(start, howMany);
				}
			}

			callback(null, data.array);
		});
	};
};