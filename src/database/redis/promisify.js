'use strict';

const util = require('util');

module.exports = function (redisClient) {
	redisClient.async = {

		exists: util.promisify(redisClient.exists).bind(redisClient),

		get: util.promisify(redisClient.get).bind(redisClient),
		set: util.promisify(redisClient.set).bind(redisClient),

		zadd: util.promisify(redisClient.zadd).bind(redisClient),

		zrem: util.promisify(redisClient.zrem).bind(redisClient),

		zrange: util.promisify(redisClient.zrange).bind(redisClient),
		zrevrange: util.promisify(redisClient.zrevrange).bind(redisClient),
		zrangebyscore: util.promisify(redisClient.zrangebyscore).bind(redisClient),
		zrevrangebyscore: util.promisify(redisClient.zrevrangebyscore).bind(redisClient),

		zscore: util.promisify(redisClient.zscore).bind(redisClient),
	};
};
