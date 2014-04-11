"use strict";

var nconf = require('nconf'),
	async = require('async');

module.exports = function(db, module) {
	module.close = function(callback) {
		db.close(callback);
	};

	module.searchIndex = function(key, content, id) {
		// o.O
	};

	module.search = function(key, term, limit, callback) {
		// O.o	
	};

	module.searchRemove = function(key, id, callback) {
		// o___O
	};

	module.flushdb = function(callback) {
		db.close(function() {
			module.leveldown.destroy(nconf.get('level:database'), function() {
				db.open(callback);
			});	
		});
	};

	module.info = function(callback) {
		// O____O      GIEF FOOD
		//  v v
	};

	module.exists = function(key, callback) {
		db.get(key, function(err, value) {
			callback(null, !!value);
		});
	};

	module.delete = function(key, callback) {
		db.del(key, callback);
	};

	module.get = function(key, callback) {
		db.get(key, function(err, value) {
			callback(false, value);
		});
	};

	module.set = function(key, value, callback, sync) {
		if (value === '') {
			callback(false);
		} else {
			var options = {
				sync: typeof sync !== 'undefined'
			};

			db.put(key, value, options, function(err) {
				// uh, err is {}.. why??
				if (typeof callback === 'function') {
					callback(null);
				}
			});
		}
	};

	module.rename = function(oldKey, newKey, callback) {
		// G__G
	};

	module.expire = function(key, seconds, callback) {
		// >__>
	};

	module.expireAt = function(key, timestamp, callback) {
		// <__<
	};

	module.iterator = function(fn, keys, value, callback) {
		var results = [];

		async.each(keys, function(key, next) {
			module[fn](key, value, function(err, result) {
				results.push(result);
				next();
			});
		}, function(err) {
			callback(err, results);
		});
	};
};