var utils = require('./../public/src/utils.js'),
	RDB = require('./redis.js'),
	async = require('async');

(function(Meta) {
	Meta.testRedis = function(callback) {
		RDB.set('nodebb-redis-test', 'foobar', function(err, res) {
			if (!err) {
				RDB.get('nodebb-redis-test', function(err, res) {
					if (!err && res === 'foobar') {
						callback(true);
					} else {
						callback(false);
					}
				});
			} else {
				callback(false);
			}
		});
	}

	Meta.config = {
		get: function(callback) {
			var config = {};

			async.waterfall([
				function(next) {
					RDB.hkeys('config', function(err, keys) {
						next(err, keys);
					});
				},
				function(keys, next) {
					async.each(keys, function(key, next) {
						RDB.hget('config', key, function(err, value) {
							if (!err) {
								config[key] = value;
							}

							next(err);
						});
					}, next);
				}
			], function(err) {
				if (!err) {
					config.status = 'ok';
					callback(config);
				} else callback({
					status: 'error'
				});
			});
		},
		set: function(field, value, callback) {
			RDB.hset('config', field, value, function(err, res) {
				callback(err);
			});
		}
	}
}(exports));