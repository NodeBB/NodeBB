"use strict";

module.exports = function(db, module) {
	var helpers = module.helpers.level;

	module.listPrepend = function(key, value, callback) {
		module.getListRange(key, 0, -1, function(err, list) {
			var arr = list || [];
			arr.unshift(value);
			module.set(key, arr, callback);
		});
	};

	module.listAppend = function(key, value, callback) {
		module.getListRange(key, 0, -1, function(err, list) {
			var arr = list || [];
			arr.push(value);
			module.set(key, arr, function(err) {
				if (typeof callback === 'function') {
					callback(err);
				}
			});
		});
	};

	module.listRemoveLast = function(key, callback) {
		module.getListRange(key, 0, -1, function(err, list) {
			var arr = list || [];
			list.pop();
			module.set(key, list, callback);
		});
	};

	module.listRemoveFirst = function(key, callback) {
		module.getListRange(key, 0, -1, function(err, list) {
			var arr = list || [];
			list.shift();
			module.set(key, list, callback);
		});
	};

	module.listRemoveAll = function(key, value, callback) {
		module.set(key, [], callback);
	};

	module.getListRange = function(key, start, stop, callback) {
		// needs testing.
		module.get(key, function(err, list) {
			if (list) {
				callback(err, list.slice(start, stop === -1 ? list.length : stop));
			} else {
				callback(null, []);
			}
		});
	};
};