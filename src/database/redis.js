

(function(module) {
	'use strict';
	var redisClient,
		redis = require('redis'),
		winston = require('winston'),
		nconf = require('nconf'),
		express = require('express'),
		connectRedis = require('connect-redis')(express),

		redis_socket_or_host = nconf.get('redis:host'),
		utils = require('./../../public/src/utils.js');


	if (redis_socket_or_host && redis_socket_or_host.indexOf('/')>=0) {
		/* If redis.host contains a path name character, use the unix dom sock connection. ie, /tmp/redis.sock */
		redisClient = redis.createClient(nconf.get('redis:host'));
	} else {
		/* Else, connect over tcp/ip */
		redisClient = redis.createClient(nconf.get('redis:port'), nconf.get('redis:host'));
	}

	module.client = redisClient;

	module.sessionStore = new connectRedis({
		client: redisClient,
		ttl: 60 * 60 * 24 * 30
	});

	if (nconf.get('redis:password')) {
		redisClient.auth(nconf.get('redis:password'));
	}

	var db = parseInt(nconf.get('redis:database'), 10);

	if (db){
		redisClient.select(db, function(error) {
			if(error) {
				winston.error("NodeBB could not connect to your Redis database. Redis returned the following error: " + error.message);
				process.exit();
			}
		});
	}

	module.init = function(callback) {
		callback(null);
	}


	/*
	 * A possibly more efficient way of doing multiple sismember calls
	 */
	function sismembers(key, needles, callback) {
		var tempkey = key + ':temp:' + utils.generateUUID();
		redisClient.sadd(tempkey, needles, function() {
			redisClient.sinter(key, tempkey, function(err, data) {
				redisClient.del(tempkey);
				callback(err, data);
			});
		});
	};

	//
	// Exported functions
	//

	module.flushdb = function(callback) {
		redisClient.send_command('flushdb', [], function(err) {
			if(err){
				winston.error(error);
				return callback(err);
			}
			callback(null);
		});
	}

	module.getFileName = function(callback) {
		var multi = redisClient.multi();

		multi.config('get', 'dir');
		multi.config('get', 'dbfilename');
		multi.exec(function (err, results) {
			if (err) {
				return callback(err);
			}

			results = results.reduce(function (memo, config) {
				memo[config[0]] = config[1];
				return memo;
			}, {});

			var dbFile = path.join(results.dir, results.dbfilename);
			callback(null, dbFile);
		});
	}


	module.info = function(callback) {
		redisClient.info(function (err, data) {
			if(err) {
				return callback(err);
			}

			data = data.split("\r\n");
			var finalData = {};

			for (var i in data) {

				if (data[i].indexOf(':') == -1 || !data[i])
					continue;

				try {
					data[i] = data[i].replace(/:/, "\":\"");
					var json = "{\"" + data[i] + "\"}";

					var jsonObject = JSON.parse(json);
					for (var key in jsonObject) {
						finalData[key] = jsonObject[key];
					}
				} catch (err) {
					winston.warn('can\'t parse redis status variable, ignoring', i, data[i], err);
				}
			}

			callback(null, finalData);
		});
	}

	// key

	module.exists = function(key, callback) {
		redisClient.exists(key, function(err, exists) {
			callback(err, exists === 1);
		});
	}

	module.delete = function(key, callback) {
		redisClient.del(key, callback);
	}

	module.get = function(key, callback) {
		redisClient.get(key, callback);
	}

	module.set = function(key, value, callback) {
		redisClient.set(key, value, callback);
	}

	module.keys = function(key, callback) {
		redisClient.keys(key, callback);
	}

	//hashes

	module.setObject = function(key, data, callback) {
		// TODO: this crashes if callback isnt supplied -baris
		redisClient.hmset(key, data, function(err, res) {
			if(callback) {
				callback(err, res);
			}
		});
	}

	module.setObjectField = function(key, field, value, callback) {
		redisClient.hset(key, field, value, callback);
	}

	module.getObject = function(key, callback) {
		redisClient.hgetall(key, callback);
	}

	module.getObjects = function(keys, callback) {
		var	multi = redisClient.multi();

		for(var x=0; x<keys.length; ++x) {
			multi.hgetall(keys[x]);
		}

		multi.exec(function (err, replies) {
			callback(err, replies);
		});
	}

	module.getObjectField = function(key, field, callback) {
		module.getObjectFields(key, [field], function(err, data) {
			if(err) {
				return callback(err);
			}

			callback(null, data[field]);
		});
	}

	module.getObjectFields = function(key, fields, callback) {
		redisClient.hmget(key, fields, function(err, data) {
			if(err) {
				return callback(err, null);
			}

			var returnData = {};

			for (var i = 0, ii = fields.length; i < ii; ++i) {
				returnData[fields[i]] = data[i];
			}

			callback(null, returnData);
		});
	}

	module.getObjectValues = function(key, callback) {
		redisClient.hvals(key, callback);
	}

	module.isObjectField = function(key, field, callback) {
		redisClient.hexists(key, field, function(err, exists) {
			callback(err, exists === 1);
		});
	}

	module.deleteObjectField = function(key, field, callback) {
		redisClient.hdel(key, field, callback);
	}

	module.incrObjectField = function(key, field, callback) {
		redisClient.hincrby(key, field, 1, callback);
	}

	module.decrObjectField = function(key, field, callback) {
		redisClient.hincrby(key, field, -1, callback);
	}

	module.incrObjectFieldBy = function(key, field, value, callback) {
		redisClient.hincrby(key, field, value, callback);
	}


	// sets

	module.setAdd = function(key, value, callback) {
		redisClient.sadd(key, value, callback);
	}

	module.setRemove = function(key, value, callback) {
		redisClient.srem(key, value, callback);
	}

	module.isSetMember = function(key, value, callback) {
		redisClient.sismember(key, value, function(err, result) {
			if(err) {
				return callback(err);
			}

			callback(null, result === 1);
		});
	}

	module.isMemberOfSets = function(sets, value, callback) {
		var batch = redisClient.multi();

		for (var i = 0, ii = sets.length; i < ii; i++) {
			batch.sismember(sets[i], value);
		}

		batch.exec(callback);
	}

	module.getSetMembers = function(key, callback) {
		redisClient.smembers(key, callback);
	}

	module.setCount = function(key, callback) {
		redisClient.scard(key, callback);
	}

	module.setRemoveRandom = function(key, callback) {
		redisClient.spop(key, callback);
	}

	// sorted sets

	module.sortedSetAdd = function(key, score, value, callback) {
		redisClient.zadd(key, score, value, callback);
	}

	module.sortedSetRemove = function(key, value, callback) {
		redisClient.zrem(key, value, callback);
	}

	module.getSortedSetRange = function(key, start, stop, callback) {
		redisClient.zrange(key, start, stop, callback);
	}

	module.getSortedSetRevRange = function(key, start, stop, callback) {
		redisClient.zrevrange(key, start, stop, callback);
	}

	module.getSortedSetRevRangeByScore = function(args, callback) {
		redisClient.zrevrangebyscore(args, callback);
	}

	module.sortedSetCount = function(key, min, max, callback) {
		redisClient.zcount(key, min, max, callback);
	}

	module.sortedSetRank = function(key, value, callback) {
		redisClient.zrank(key, value, callback);
	}

	// lists
	module.listPrepend = function(key, value, callback) {
		redisClient.lpush(key, value, callback);
	}

	module.listAppend = function(key, value, callback) {
		redisClient.rpush(key, value, callback);
	}

	module.listRemoveLast = function(key, callback) {
		redisClient.rpop(key, callback);
	}

	module.getListRange = function(key, start, stop, callback) {
		redisClient.lrange(key, start, stop, callback);
	}




}(exports));

