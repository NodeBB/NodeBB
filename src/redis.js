(function(RedisDB) {
	var PRODUCTION = false,
		ERROR_LOGS = true,

		redis = require('redis'),
		config = require('../config.js'),
		utils = require('./../public/src/utils.js');
	

	RedisDB.exports = redis.createClient(config.redis.port, config.redis.host, config.redis.options);

	RedisDB.exports.handle = function(error) {
		if (error !== null) {
			if (PRODUCTION === false) {
				console.log("################# ERROR LOG ####################");
				console.log(error);
				console.log(arguments.callee.name);
				console.log("################# ERROR LOG ####################");
				throw new Error('RedisDB Error: ' + error);
			} else if (ERROR_LOGS === true) {
				console.log('RedisDB Error: ' + error);
			}
		}
	}


	/*
	* A possibly more efficient way of doing multiple sismember calls
	*/
	RedisDB.exports.sismembers = function(key, needles, callback) {
		var tempkey = key + ':temp:' + utils.generateUUID();
		RedisDB.exports.sadd(tempkey, needles, function() {
			RedisDB.exports.sinter(key, tempkey, function(err, data) {
				RedisDB.exports.del(tempkey);
				callback(err, data);
			});
		});
	};

}(module));