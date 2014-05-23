"use strict";

module.exports = function(redisClient, module) {
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

	module.getSortedSetRevRangeWithScores = function(key, start, stop, callback) {
		redisClient.zrevrange([key, start, stop, 'WITHSCORES'], function(err, data) {
			if (err) {
				return callback(err);
			}
			var objects = [];
			for(var i=0; i<data.length; i+=2) {
				objects.push({value: data[i], score: data[i+1]});
			}
			callback(null, objects);
		});
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

	module.getSortedSetUnion = function(sets, start, stop, callback) {
		// start and stop optional
		if (typeof start === 'function') {
			callback = start;
			start = 0;
			stop = -1;
		} else if (typeof stop === 'function') {
			callback = stop;
			stop = -1;
		}

		var	multi = redisClient.multi();

		// zunionstore prep
		sets.unshift(sets.length);
		sets.unshift('temp');

		multi.zunionstore.apply(multi, sets);
		multi.zrange('temp', start, stop);
		multi.del('temp');
		multi.exec(function(err, results) {
			if (!err && typeof callback === 'function') {
				callback(null, results[1]);
			} else if (err) {
				callback(err);
			}
		});
	}
};