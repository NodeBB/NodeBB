"use strict";

var async = require('async');

module.exports = function(db, module) {
	var helpers = module.helpers.level;

	module.setObject = function(key, obj, callback) {
		async.parallel([
			function(next) {
				async.each(Object.keys(obj), function(objKey, next) {
					module.setObjectField(key, objKey, obj[objKey], next);
				}, next);
			},
			function(next) {
				module.set(key, Object.keys(obj).join('-ldb-'));
				next();
			}
		], function(err) {
			if (typeof callback === 'function') {
				callback(err);
			}
		});
	};

	module.setObjectField = function(key, field, value, callback) {
		module.set(key + ':' + field, value, callback);
	};

	module.getObject = function(key, callback) {
		var obj = {};

		module.getObjectKeys(key, function(err, keys) {
			if (keys) {
				keys = keys.split('-ldb-');
				async.each(keys, function(field, next) {
					module.getObjectField(key, field, function(err, value) {
						obj[field] = value;
						next(err);
					});
				}, function(err) {
					if (typeof callback === 'function') {
						callback(err, obj);
					}
				});
			} else {
				if (typeof callback === 'function') {
					callback(err, {});
				}
			}
		});
	};

	module.getObjects = function(keys, callback) {
		var arr = [];

		async.each(keys, function(key, next) {
			module.getObject(key, function(err, val) {
				arr.push(val);
				next();
			});
		}, function(err) {
			callback(err, arr);
		});
	};

	module.getObjectField = function(key, field, callback) {
		module.get(key + ':' + field, function(err, val) {
			callback(err, typeof val !== 'undefined' ? val : '');
		});
	};

	module.getObjectFields = function(key, fields, callback) {
		// can be improved with multi.
		var obj = {};
		async.each(fields, function(field, next) {
			module.getObjectField(key, field, function(err, value) {
				obj[field] = value;
				next();
			});
		}, function(err) {
			callback(err, obj);
		});
	};

	module.getObjectsFields = function(keys, fields, callback) {
		helpers.iterator('getObjectFields', keys, fields, callback);
	};

	module.getObjectKeys = function(key, callback) {
		module.get(key, callback);
	};

	module.getObjectValues = function(key, callback) {
		module.getObject(key, function(err, obj) {
			var values = [];
			for (var key in obj) {
				if (obj.hasOwnProperty(key)) {
					values.push(obj[key]);
				}
			}

			callback(err, values);
		});
	};

	module.isObjectField = function(key, field, callback) {
		module.get(key + ':' + field, function(err, val) {
			callback(err, !!val);
		});
	};

	module.deleteObjectField = function(key, field, callback) {
		module.delete(key + ':' + field, callback);
	};

	module.incrObjectField = function(key, field, callback) {
		module.incrObjectFieldBy(key, field, 1, callback);
	};

	module.decrObjectField = function(key, field, callback) {
		module.decrObjectFieldBy(key, field, 1, callback);
	};

	module.incrObjectFieldBy = function(key, field, value, callback) {
		module.get(key + ':' + field, function(err, val) {
			val = val ? (val + value) : value;
			module.set(key + ':' + field, val, function(err) {
				if (typeof callback === 'function') {
					callback(err, val);
				}
			});
		});
	};

	module.decrObjectFieldBy = function(key, field, value, callback) {
		module.get(key + ':' + field, function(err, val) {
			val = val ? (val - value) : -value;
			module.set(key + ':' + field, val, function(err) {
				if (typeof callback === 'function') {
					callback(err, val);
				}
			});
		});
	};
};