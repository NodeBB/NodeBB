(function(RedisDB) {
	var PRODUCTION = false,
		ERROR_LOGS = true,

		redis = require('redis'),
		config = require('../config.js');
	

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

}(module));