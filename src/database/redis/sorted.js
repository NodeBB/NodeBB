"use strict";

module.exports = function(redisClient, module) {

	var helpers = module.helpers.redis;

	module.sortedSetAdd = function(key, score, value, callback) {
		callback = callback || function() {};
		if (Array.isArray(score) && Array.isArray(value)) {
			return sortedSetAddMulti(key, score, value, callback);
		}
		redisClient.zadd(key, score, value, function(err) {
			callback(err);
		});
	};

	function sortedSetAddMulti(key, scores, values, callback) {
		if (!scores.length || !values.length) {
			return callback();
		}

		if (scores.length !== values.length) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		var args = [key];

		for(var i=0; i<scores.length; ++i) {
			args.push(scores[i], values[i]);
		}

		redisClient.zadd(args, function(err, res) {
			callback(err);
		});
	}

	module.sortedSetsAdd = function(keys, score, value, callback) {
		callback = callback || function() {};
		var multi = redisClient.multi();

		for(var i=0; i<keys.length; ++i) {
			multi.zadd(keys[i], score, value);
		}

		multi.exec(function(err, res) {
			callback(err);
		});
	};

	module.sortedSetRemove = function(key, value, callback) {
		callback = callback || function() {};
		if (!Array.isArray(value)) {
			value = [value];
		}

		helpers.multiKeyValues(redisClient, 'zrem', key, value, function(err, result) {
			callback(err);
		});
	};

	module.sortedSetsRemove = function(keys, value, callback) {
		helpers.multiKeysValue(redisClient, 'zrem', keys, value, function(err, result) {
			callback(err);
		});
	};

	module.sortedSetsRemoveRangeByScore = function(keys, min, max, callback) {
		callback = callback || function() {};
		var multi = redisClient.multi();
		for(var i=0; i<keys.length; ++i) {
			multi.zremrangebyscore(keys[i], min, max);
		}
		multi.exec(function(err, result) {
			callback(err);
		});
	};

	module.getSortedSetRange = function(key, start, stop, callback) {
		sortedSetRange('zrange', key, start, stop, false, callback);
	};

	module.getSortedSetRevRange = function(key, start, stop, callback) {
		sortedSetRange('zrevrange', key, start, stop, false, callback);
	};

	module.getSortedSetRangeWithScores = function(key, start, stop, callback) {
		sortedSetRange('zrange', key, start, stop, true, callback);
	};

	module.getSortedSetRevRangeWithScores = function(key, start, stop, callback) {
		sortedSetRange('zrevrange', key, start, stop, true, callback);
	};

	function sortedSetRange(method, key, start, stop, withScores, callback) {
		if (Array.isArray(key)) {
			return sortedSetUnion(method, key, start, stop, withScores, callback);
		}

		var params = [key, start, stop];
		if (withScores) {
			params.push('WITHSCORES');
		}

		redisClient[method](params, function(err, data) {
			if (err) {
				return callback(err);
			}
			if (!withScores) {
				return callback(null, data);
			}
			var objects = [];
			for(var i=0; i<data.length; i+=2) {
				objects.push({value: data[i], score: data[i + 1]});
			}
			callback(null, objects);
		});
	}

	module.getSortedSetRangeByScore = function(key, start, count, min, max, callback) {
		redisClient.zrangebyscore([key, min, max, 'LIMIT', start, count], callback);
	};

	module.getSortedSetRevRangeByScore = function(key, start, count, max, min, callback) {
		redisClient.zrevrangebyscore([key, max, min, 'LIMIT', start, count], callback);
	};

	module.getSortedSetRangeByScoreWithScores = function(key, start, count, min, max, callback) {
		sortedSetRangeByScoreWithScores('zrangebyscore', key, start, count, min, max, callback);
	};

	module.getSortedSetRevRangeByScoreWithScores = function(key, start, count, max, min, callback) {
		sortedSetRangeByScoreWithScores('zrevrangebyscore', key, start, count, max, min, callback);
	};

	function sortedSetRangeByScoreWithScores(method, key, start, count, min, max, callback) {
		redisClient[method]([key, min, max, 'WITHSCORES', 'LIMIT', start, count], function(err, data) {
			if (err) {
				return callback(err);
			}
			var objects = [];
			for(var i=0; i<data.length; i+=2) {
				objects.push({value: data[i], score: data[i+1]});
			}
			callback(null, objects);
		});
	}

	module.sortedSetCount = function(key, min, max, callback) {
		redisClient.zcount(key, min, max, callback);
	};

	module.sortedSetCard = function(key, callback) {
		redisClient.zcard(key, callback);
	};

	module.sortedSetsCard = function(keys, callback) {
		if (Array.isArray(keys) && !keys.length) {
			return callback(null, []);
		}
		var multi = redisClient.multi();
		for(var i=0; i<keys.length; ++i) {
			multi.zcard(keys[i]);
		}
		multi.exec(callback);
	};

	module.sortedSetRank = function(key, value, callback) {
		redisClient.zrank(key, value, callback);
	};

	module.sortedSetsRanks = function(keys, values, callback) {
		var multi = redisClient.multi();
		for(var i=0; i<values.length; ++i) {
			multi.zrank(keys[i], values[i]);
		}
		multi.exec(callback);
	};

	module.sortedSetRanks = function(key, values, callback) {
		var multi = redisClient.multi();
		for(var i=0; i<values.length; ++i) {
			multi.zrank(key, values[i]);
		}
		multi.exec(callback);
	};

	module.sortedSetRevRank = function(key, value, callback) {
		redisClient.zrevrank(key, value, callback);
	};

	module.sortedSetScore = function(key, value, callback) {
		redisClient.zscore(key, value, callback);
	};

	module.sortedSetsScore = function(keys, value, callback) {
		helpers.multiKeysValue(redisClient, 'zscore', keys, value, callback);
	};

	module.sortedSetScores = function(key, values, callback) {
		helpers.multiKeyValues(redisClient, 'zscore', key, values, callback);
	};

	module.isSortedSetMember = function(key, value, callback) {
		module.sortedSetScore(key, value, function(err, score) {
			callback(err, !!score);
		});
	};

	module.isSortedSetMembers = function(key, values, callback) {
		helpers.multiKeyValues(redisClient, 'zscore', key, values, function(err, results) {
			if (err) {
				return callback(err);
			}
			callback(null, results.map(Boolean));
		});
	};

	module.isMemberOfSortedSets = function(keys, value, callback) {
		helpers.multiKeysValue(redisClient, 'zscore', keys, value, function(err, results) {
			if (err) {
				return callback(err);
			}
			callback(null, results.map(Boolean));
		});
	};

	module.getSortedSetsMembers = function(keys, callback) {
		var multi = redisClient.multi();
		for (var i=0; i<keys.length; ++i) {
			multi.zrange(keys[i], 0, -1);
		}
		multi.exec(callback);
	};

	module.getSortedSetUnion = function(sets, start, stop, callback) {
		sortedSetUnion('zrange', sets, start, stop, false, callback);
	};

	module.getSortedSetRevUnion = function(sets, start, stop, callback) {
		sortedSetUnion('zrevrange', sets, start, stop, false, callback);
	};

	function sortedSetUnion(method, sets, start, stop, withScores, callback) {

		var tempSetName = 'temp_' + Date.now();

		var params = [tempSetName, start, stop];
		if (withScores) {
			params.push('WITHSCORES');
		}

		var	multi = redisClient.multi();
		multi.zunionstore([tempSetName, sets.length].concat(sets));
		multi[method](params);
		multi.del(tempSetName);
		multi.exec(function(err, results) {
			if (err) {
				return callback(err);
			}
			if (!withScores) {
				return callback(null, results ? results[1] : null);
			}
			results = results[1] || [];
			var objects = [];
			for(var i=0; i<results.length; i+=2) {
				objects.push({value: results[i], score: results[i + 1]});
			}
			callback(null, objects);
		});
	}

	module.sortedSetIncrBy = function(key, increment, value, callback) {
		redisClient.zincrby(key, increment, value, callback);
	};

	module.getSortedSetRangeByLex = function(key, min, max, start, count, callback) {
		if (min !== '-') {
			min = '[' + min;
		}
		if (max !== '+') {
			max = '(' + max;
		}
		redisClient.zrangebylex([key, min, max, 'LIMIT', start, count], callback);
	};
};