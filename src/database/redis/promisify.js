'use strict';

const util = require('util');

module.exports = function (redisClient) {
	redisClient.async = {
		send_command: util.promisify(redisClient.send_command).bind(redisClient),

		exists: util.promisify(redisClient.exists).bind(redisClient),
		scan: util.promisify(redisClient.scan).bind(redisClient),

		del: util.promisify(redisClient.del).bind(redisClient),
		get: util.promisify(redisClient.get).bind(redisClient),
		set: util.promisify(redisClient.set).bind(redisClient),
		incr: util.promisify(redisClient.incr).bind(redisClient),
		rename: util.promisify(redisClient.rename).bind(redisClient),
		type: util.promisify(redisClient.type).bind(redisClient),
		expire: util.promisify(redisClient.expire).bind(redisClient),
		expireat: util.promisify(redisClient.expireat).bind(redisClient),
		pexpire: util.promisify(redisClient.pexpire).bind(redisClient),
		pexpireat: util.promisify(redisClient.pexpireat).bind(redisClient),
		ttl: util.promisify(redisClient.ttl).bind(redisClient),
		pttl: util.promisify(redisClient.pttl).bind(redisClient),

		hmset: util.promisify(redisClient.hmset).bind(redisClient),
		hset: util.promisify(redisClient.hset).bind(redisClient),
		hget: util.promisify(redisClient.hget).bind(redisClient),
		hdel: util.promisify(redisClient.hdel).bind(redisClient),
		hgetall: util.promisify(redisClient.hgetall).bind(redisClient),
		hkeys: util.promisify(redisClient.hkeys).bind(redisClient),
		hvals: util.promisify(redisClient.hvals).bind(redisClient),
		hexists: util.promisify(redisClient.hexists).bind(redisClient),
		hincrby: util.promisify(redisClient.hincrby).bind(redisClient),

		sadd: util.promisify(redisClient.sadd).bind(redisClient),
		srem: util.promisify(redisClient.srem).bind(redisClient),
		sismember: util.promisify(redisClient.sismember).bind(redisClient),
		smembers: util.promisify(redisClient.smembers).bind(redisClient),
		scard: util.promisify(redisClient.scard).bind(redisClient),
		spop: util.promisify(redisClient.spop).bind(redisClient),

		zadd: util.promisify(redisClient.zadd).bind(redisClient),
		zrem: util.promisify(redisClient.zrem).bind(redisClient),
		zrange: util.promisify(redisClient.zrange).bind(redisClient),
		zrevrange: util.promisify(redisClient.zrevrange).bind(redisClient),
		zrangebyscore: util.promisify(redisClient.zrangebyscore).bind(redisClient),
		zrevrangebyscore: util.promisify(redisClient.zrevrangebyscore).bind(redisClient),
		zscore: util.promisify(redisClient.zscore).bind(redisClient),
		zcount: util.promisify(redisClient.zcount).bind(redisClient),
		zcard: util.promisify(redisClient.zcard).bind(redisClient),
		zrank: util.promisify(redisClient.zrank).bind(redisClient),
		zrevrank: util.promisify(redisClient.zrevrank).bind(redisClient),
		zincrby: util.promisify(redisClient.zincrby).bind(redisClient),
		zrangebylex: util.promisify(redisClient.zrangebylex).bind(redisClient),
		zrevrangebylex: util.promisify(redisClient.zrevrangebylex).bind(redisClient),
		zremrangebylex: util.promisify(redisClient.zremrangebylex).bind(redisClient),
		zlexcount: util.promisify(redisClient.zlexcount).bind(redisClient),
		zscan: util.promisify(redisClient.zscan).bind(redisClient),

		lpush: util.promisify(redisClient.lpush).bind(redisClient),
		rpush: util.promisify(redisClient.rpush).bind(redisClient),
		rpop: util.promisify(redisClient.rpop).bind(redisClient),
		lrem: util.promisify(redisClient.lrem).bind(redisClient),
		ltrim: util.promisify(redisClient.ltrim).bind(redisClient),
		lrange: util.promisify(redisClient.lrange).bind(redisClient),
		llen: util.promisify(redisClient.llen).bind(redisClient),

	};
};
