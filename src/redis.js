(function(RedisDB) {
	var PRODUCTION = false,
		ERROR_LOGS = true,

		redis = require('redis'),
		config = require('../config.js'),
		db = redis.createClient(config.redis.port, config.redis.host, config.redis.options);

	RedisDB.db = db;

	// todo (holy cow): append,auth,bgrewriteaof,bgsave,bitcount,bitop,blpop,brpop,brpoplpush,client kill,client list,client getname,client setname,config get,config set,config resetstat,dbsize,debug object,debug segfault,decrby,discard,dump,echo,eval,evalsha,exec,exists,expireat,flushall,flushdb,getbit,getrange,getset,hdel,hexists,hget,hgetall,hincrby,hincrbyfloat,hkeys,hlen,hmget,hmset,hset,hsetnx,hvals,incrby,incrbyfloat,info,lastsave,lindex,linsert,llen,lpop,lpushx,lrem,lset,ltrim,migrate,monitor,move,mset,msetnx,object,persist,pexpire,pexpireat,ping,psetex,psubscribe,pttl,publish,punsubscribe,quit,randomkey,rename,renamenx,restore,rpop,rpoplpush,rpush,rpushx,sadd,save,scard,script exists,script flush,script kill,script load,sdiff,sdiffstore,select,setbit,setex,setnx,setrange,shutdown,sinter,sinterstore,sismember,slaveof,slowlog,smembers,smove,sort,spop,srandmember,srem,strlen,subscribe,sunion,sunionstore,sync,time,ttl,type,unsubscribe,unwatch,watch,zadd,zcard,zcount,zincrby,zinterstore,zrange,zrangebyscore,zrank,zrem,zremrangebyrank,zremrangebyscore,zrevrange,zrevrangebyscore,zrevrank,zscore,zunionstore
	// done: get, set, incr, decr, del, mget, multi, expire, lpush, lrange, keys

	function return_handler(error, data, callback, error_handler) {
		if (error !== null) {
			if (error_handler !== null) {
				error_handler(error);
			} else if (PRODUCTION === false) {
				throw new Exception('RedisDB Error: ' + error);
			} else if (ERROR_LOGS === true) {
				console.log('RedisDB Error: ' + error);
			}
		} else {
			callback(data);
		}
	}

	RedisDB.set = function(key, value, expiry) {
		db.set(key, value);
		if (expiry !== undefined) RedisDB.expire(key, expiry);
	};

	RedisDB.get = function(key, callback, error_handler) {
		db.get(key, function(error, data) {
			return_handler(error, data, callback, error_handler);
		});
	};

	RedisDB.mget = function(keys, callback, error_handler) {
		db.mget(keys, function(error, data) {
			return_handler(error, data, callback, error_handler);
		});
	};

	RedisDB.multi = function() {
		return db.multi();
	}

	RedisDB.keys = function(pattern, callback, error_handler) {
		return db.keys(pattern, function(error, data) {
			return_handler(error, data, callback, error_handler);
		});
	}

	RedisDB.del = function(key, callback) {
		db.del(key);
	}

	RedisDB.expire = function(key, expiry) {
		db.expire(key, expiry);
	}

	// Atomic Operations
	RedisDB.incr = function(key, callback, error_handler) {
		db.incr(key, function(error, data) {
			if (callback) {
				return_handler(error, data, callback, error_handler);
			}
		});
	};

	RedisDB.decr = function(key) {
		db.decr(key);
	};

	// Lists
	RedisDB.lpush = function(key, item) {
		db.lpush(key, item);
	}

	RedisDB.rpush = function(key, item) {
		db.rpush(key, item);
	}

	RedisDB.lrange = function(key, start, end, callback, error_handler) {
		db.lrange(key, start, end, function(error, data) {
			return_handler(error, data, callback, error_handler);
		});
	}

	// Sets
	RedisDB.sadd = function(key, item) {
		db.sadd(key, item);
	};

	RedisDB.srem = function(key, item) {
		db.srem(key, item);
	};

	RedisDB.sismember = function(key, item, callback, error_handler) {
		db.sismember(key, item, function(error, data) {
			return_handler(error, data, callback, error_handler);
		});
	};

}(exports));