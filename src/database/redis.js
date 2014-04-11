'use strict';

(function(module) {

	var winston = require('winston'),
		nconf = require('nconf'),
		path = require('path'),
		express = require('express'),
		redis_socket_or_host = nconf.get('redis:host'),
		utils = require('./../../public/src/utils.js'),
		redis,
		connectRedis,
		reds,
		redisClient,
		postSearch,
		topicSearch;

	try {
		redis = require('redis');
		connectRedis = require('connect-redis')(express);
		reds = require('reds');
	} catch (err) {
		winston.error('Unable to initialize Redis! Is Redis installed? Error :' + err.message);
		process.exit();
	}

	module.init = function(callback) {
		if (redis_socket_or_host && redis_socket_or_host.indexOf('/')>=0) {
			/* If redis.host contains a path name character, use the unix dom sock connection. ie, /tmp/redis.sock */
			redisClient = redis.createClient(nconf.get('redis:host'));
		} else {
			/* Else, connect over tcp/ip */
			redisClient = redis.createClient(nconf.get('redis:port'), nconf.get('redis:host'));
		}

		if (nconf.get('redis:password')) {
			redisClient.auth(nconf.get('redis:password'));
		} else {
			winston.warn('You have no redis password setup!');
		}

		redisClient.on('error', function (err) {
			winston.error(err.message);
			process.exit();
		});

		module.client = redisClient;

		module.sessionStore = new connectRedis({
			client: redisClient,
			ttl: 60 * 60 * 24 * 14
		});

		reds.createClient = function () {
			return reds.client || (reds.client = redisClient);
		};

		postSearch = reds.createSearch('nodebbpostsearch');
		topicSearch = reds.createSearch('nodebbtopicsearch');

		var db = parseInt(nconf.get('redis:database'), 10);

		if (db) {
			redisClient.select(db, function(error) {
				if(error) {
					winston.error("NodeBB could not connect to your Redis database. Redis returned the following error: " + error.message);
					process.exit();
				}
			});
		}

		if(typeof callback === 'function') {
			callback();
		}
	};

	module.close = function() {
		redisClient.quit();
	};

	//
	// Exported functions
	//
	module.searchIndex = function(key, content, id) {
		if (key === 'post') {
			postSearch.index(content, id);
		} else if(key === 'topic') {
			topicSearch.index(content, id);
		}
	};

	module.search = function(key, term, limit, callback) {
		function search(searchObj, callback) {
			searchObj
				.query(term)
				.between(0, limit - 1)
				.type('or')
				.end(callback);
		}

		if(key === 'post') {
			search(postSearch, callback);
		} else if(key === 'topic') {
			search(topicSearch, callback);
		}
	};

	module.searchRemove = function(key, id, callback) {
		if(key === 'post') {
			postSearch.remove(id);
		} else if(key === 'topic') {
			topicSearch.remove(id);
		}

		if (typeof callback === 'function') {
			callback();
		}
	};

	module.flushdb = function(callback) {
		redisClient.send_command('flushdb', [], function(err) {
			if (typeof callback === 'function') {
				callback(err);
			}
		});
	};

	module.info = function(callback) {
		redisClient.info(function (err, data) {
			if(err) {
				return callback(err);
			}

			var lines = data.toString().split("\r\n").sort();
			var redisData = {};
			lines.forEach(function (line) {
				var parts = line.split(':');
				if (parts[1]) {
					redisData[parts[0]] = parts[1];
				}
			});

			redisData.raw = JSON.stringify(redisData, null, 4);
			redisData.redis = true;

			callback(null, redisData);
		});
	};

	// key

	module.exists = function(key, callback) {
		redisClient.exists(key, function(err, exists) {
			callback(err, exists === 1);
		});
	};

	module.delete = function(key, callback) {
		redisClient.del(key, callback);
	};

	module.get = function(key, callback) {
		redisClient.get(key, callback);
	};

	module.set = function(key, value, callback) {
		redisClient.set(key, value, callback);
	};

	module.rename = function(oldKey, newKey, callback) {
		redisClient.rename(oldKey, newKey, callback);
	};

	module.expire = function(key, seconds, callback) {
		redisClient.expire(key, seconds, callback);
	};

	module.expireAt = function(key, timestamp, callback) {
		redisClient.expireat(key, timestamp, callback);
	};

	//hashes

	module.setObject = function(key, data, callback) {
		// TODO: this crashes if callback isnt supplied -baris
		redisClient.hmset(key, data, function(err, res) {
			if(typeof callback === 'function') {
				callback(err, res);
			}
		});
	};

	module.setObjectField = function(key, field, value, callback) {
		redisClient.hset(key, field, value, callback);
	};

	module.getObject = function(key, callback) {
		redisClient.hgetall(key, callback);
	};

	module.getObjects = function(keys, callback) {
		var	multi = redisClient.multi();

		for(var x=0; x<keys.length; ++x) {
			multi.hgetall(keys[x]);
		}

		multi.exec(callback);
	};

	module.getObjectField = function(key, field, callback) {
		module.getObjectFields(key, [field], function(err, data) {
			if(err) {
				return callback(err);
			}

			callback(null, data[field]);
		});
	};

	module.getObjectFields = function(key, fields, callback) {
		module.getObjectsFields([key], fields, function(err, results) {
			callback(err, results ? results[0]: null);
		});
	};

	module.getObjectsFields = function(keys, fields, callback) {
		var	multi = redisClient.multi();

		for(var x=0; x<keys.length; ++x) {
			multi.hmget.apply(multi, [keys[x]].concat(fields));
		}

		function makeObject(array) {
			var obj = {};

			for (var i = 0, ii = fields.length; i < ii; ++i) {
				obj[fields[i]] = array[i];
			}
			return obj;
		}

		multi.exec(function(err, results) {
			if (err) {
				return callback(err);
			}

			results = results.map(makeObject);
			callback(null, results);
		});
	};

	module.getObjectKeys = function(key, callback) {
		redisClient.hkeys(key, callback);
	};

	module.getObjectValues = function(key, callback) {
		redisClient.hvals(key, callback);
	};

	module.isObjectField = function(key, field, callback) {
		redisClient.hexists(key, field, function(err, exists) {
			callback(err, exists === 1);
		});
	};

	module.deleteObjectField = function(key, field, callback) {
		redisClient.hdel(key, field, callback);
	};

	module.incrObjectField = function(key, field, callback) {
		redisClient.hincrby(key, field, 1, callback);
	};

	module.decrObjectField = function(key, field, callback) {
		redisClient.hincrby(key, field, -1, callback);
	};

	module.incrObjectFieldBy = function(key, field, value, callback) {
		redisClient.hincrby(key, field, value, callback);
	};


	// sets

	module.setAdd = function(key, value, callback) {
		redisClient.sadd(key, value, callback);
	};

	module.setRemove = function(key, value, callback) {
		redisClient.srem(key, value, callback);
	};

	module.isSetMember = function(key, value, callback) {
		redisClient.sismember(key, value, function(err, result) {
			if(err) {
				return callback(err);
			}

			callback(null, result === 1);
		});
	};

	module.isSetMembers = function(key, values, callback) {
		var multi = redisClient.multi();
		for (var i=0; i<values.length; ++i) {
			multi.sismember(key, values[i]);
		}

		multi.exec(function(err, results) {
			if (err) {
				return callback(err);
			}

			for (var i=0; i<results.length; ++i) {
				results[i] = results[i] === 1;
			}
			callback(null, results);
		});
	};

	module.isMemberOfSets = function(sets, value, callback) {
		var multi = redisClient.multi();

		for (var i = 0, ii = sets.length; i < ii; i++) {
			multi.sismember(sets[i], value);
		}

		multi.exec(callback);
	};

	module.getSetMembers = function(key, callback) {
		redisClient.smembers(key, callback);
	};

	module.setCount = function(key, callback) {
		redisClient.scard(key, callback);
	};

	module.setRemoveRandom = function(key, callback) {
		redisClient.spop(key, callback);
	};

	// sorted sets

	module.sortedSetAdd = function(key, score, value, callback) {
		redisClient.zadd(key, score, value, callback);
	};

	module.sortedSetRemove = function(key, value, callback) {
		redisClient.zrem(key, value, callback);
	};

	module.getSortedSetRange = function(key, start, stop, callback) {
		redisClient.zrange(key, start, stop, callback);
	};

	module.getSortedSetRevRange = function(key, start, stop, callback) {
		redisClient.zrevrange(key, start, stop, callback);
	};

	module.getSortedSetRangeByScore = function(key, start, count, min, max, callback) {
		redisClient.zrangebyscore([key, min, max, 'LIMIT', start, count], callback);
	};

	module.getSortedSetRevRangeByScore = function(key, start, count, max, min, callback) {
		redisClient.zrevrangebyscore([key, max, min, 'LIMIT', start, count], callback);
	};

	module.sortedSetCount = function(key, min, max, callback) {
		redisClient.zcount(key, min, max, callback);
	};

	module.sortedSetCard = function(key, callback) {
		redisClient.zcard(key, callback);
	};

	module.sortedSetRank = function(key, value, callback) {
		redisClient.zrank(key, value, callback);
	};

	module.sortedSetRevRank = function(key, value, callback) {
		redisClient.zrevrank(key, value, callback);
	};

	module.sortedSetScore = function(key, value, callback) {
		redisClient.zscore(key, value, callback);
	};

	module.isSortedSetMember = function(key, value, callback) {
		module.sortedSetScore(key, value, function(err, score) {
			callback(err, !!score);
		});
	};

	module.sortedSetsScore = function(keys, value, callback) {
		var	multi = redisClient.multi();

		for(var x=0; x<keys.length; ++x) {
			multi.zscore(keys[x], value);
		}

		multi.exec(callback);
	};

	// lists
	module.listPrepend = function(key, value, callback) {
		redisClient.lpush(key, value, callback);
	};

	module.listAppend = function(key, value, callback) {
		redisClient.rpush(key, value, callback);
	};

	module.listRemoveLast = function(key, callback) {
		redisClient.rpop(key, callback);
	};

	module.listRemoveAll = function(key, value, callback) {
		redisClient.lrem(key, 0, value, callback);
	};

	module.getListRange = function(key, start, stop, callback) {
		redisClient.lrange(key, start, stop, callback);
	};

}(exports));

