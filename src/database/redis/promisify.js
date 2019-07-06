'use strict';

const util = require('util');

module.exports = function (redisClient) {
	redisClient.async = {

		exists: util.promisify(redisClient.exists).bind(redisClient),

		get: util.promisify(redisClient.get).bind(redisClient),
		set: util.promisify(redisClient.set).bind(redisClient),

		hmset: util.promisify(redisClient.hmset).bind(redisClient),
		hset: util.promisify(redisClient.hset).bind(redisClient),
		hget: util.promisify(redisClient.hget).bind(redisClient),
		hgetall: util.promisify(redisClient.hgetall).bind(redisClient),
		hkeys: util.promisify(redisClient.hkeys).bind(redisClient),
		hvals: util.promisify(redisClient.hvals).bind(redisClient),
		hexists: util.promisify(redisClient.hexists).bind(redisClient),

		zadd: util.promisify(redisClient.zadd).bind(redisClient),
		zrem: util.promisify(redisClient.zrem).bind(redisClient),
		zrange: util.promisify(redisClient.zrange).bind(redisClient),
		zrevrange: util.promisify(redisClient.zrevrange).bind(redisClient),
		zrangebyscore: util.promisify(redisClient.zrangebyscore).bind(redisClient),
		zrevrangebyscore: util.promisify(redisClient.zrevrangebyscore).bind(redisClient),
		zscore: util.promisify(redisClient.zscore).bind(redisClient),
	};
};
