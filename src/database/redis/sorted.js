"use strict";

module.exports = function (redisClient, module) {

	var utils = require('../../../public/src/utils');

	var helpers = module.helpers.redis;

	module.sortedSetAdd = function (key, score, value, callback) {
		callback = callback || function () {};
		if (Array.isArray(score) && Array.isArray(value)) {
			return sortedSetAddMulti(key, score, value, callback);
		}
		redisClient.zadd(key, score, value, function (err) {
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

		for(var i = 0; i < scores.length; ++i) {
			args.push(scores[i], values[i]);
		}

		redisClient.zadd(args, function (err) {
			callback(err);
		});
	}

	module.sortedSetsAdd = function (keys, score, value, callback) {
		callback = callback || function () {};
		var multi = redisClient.multi();

		for(var i = 0; i < keys.length; ++i) {
			multi.zadd(keys[i], score, value);
		}

		multi.exec(function (err) {
			callback(err);
		});
	};

	module.sortedSetRemove = function (key, value, callback) {
		callback = callback || function () {};
		if (!value) {
			return callback();
		}
		if (!Array.isArray(value)) {
			value = [value];
		}

		helpers.multiKeyValues(redisClient, 'zrem', key, value, function (err) {
			callback(err);
		});
	};

	module.sortedSetsRemove = function (keys, value, callback) {
		helpers.multiKeysValue(redisClient, 'zrem', keys, value, function (err) {
			callback(err);
		});
	};

	module.sortedSetsRemoveRangeByScore = function (keys, min, max, callback) {
		callback = callback || function () {};
		var multi = redisClient.multi();
		for(var i = 0; i < keys.length; ++i) {
			multi.zremrangebyscore(keys[i], min, max);
		}
		multi.exec(function (err) {
			callback(err);
		});
	};

	module.getSortedSetRange = function (key, start, stop, callback) {
		sortedSetRange('zrange', key, start, stop, false, callback);
	};

	module.getSortedSetRevRange = function (key, start, stop, callback) {
		sortedSetRange('zrevrange', key, start, stop, false, callback);
	};

	module.getSortedSetRangeWithScores = function (key, start, stop, callback) {
		sortedSetRange('zrange', key, start, stop, true, callback);
	};

	module.getSortedSetRevRangeWithScores = function (key, start, stop, callback) {
		sortedSetRange('zrevrange', key, start, stop, true, callback);
	};

	function sortedSetRange(method, key, start, stop, withScores, callback) {
		if (Array.isArray(key)) {
			return sortedSetUnion({method: method, sets: key, start: start, stop: stop, withScores: withScores}, callback);
		}

		var params = [key, start, stop];
		if (withScores) {
			params.push('WITHSCORES');
		}

		redisClient[method](params, function (err, data) {
			if (err) {
				return callback(err);
			}
			if (!withScores) {
				return callback(null, data);
			}
			var objects = [];
			for(var i = 0; i < data.length; i += 2) {
				objects.push({value: data[i], score: parseFloat(data[i + 1])});
			}
			callback(null, objects);
		});
	}

	module.getSortedSetRangeByScore = function (key, start, count, min, max, callback) {
		redisClient.zrangebyscore([key, min, max, 'LIMIT', start, count], callback);
	};

	module.getSortedSetRevRangeByScore = function (key, start, count, max, min, callback) {
		redisClient.zrevrangebyscore([key, max, min, 'LIMIT', start, count], callback);
	};

	module.getSortedSetRangeByScoreWithScores = function (key, start, count, min, max, callback) {
		sortedSetRangeByScoreWithScores('zrangebyscore', key, start, count, min, max, callback);
	};

	module.getSortedSetRevRangeByScoreWithScores = function (key, start, count, max, min, callback) {
		sortedSetRangeByScoreWithScores('zrevrangebyscore', key, start, count, max, min, callback);
	};

	function sortedSetRangeByScoreWithScores(method, key, start, count, min, max, callback) {
		redisClient[method]([key, min, max, 'WITHSCORES', 'LIMIT', start, count], function (err, data) {
			if (err) {
				return callback(err);
			}
			var objects = [];
			for(var i = 0; i < data.length; i += 2) {
				objects.push({value: data[i], score: parseFloat(data[i + 1])});
			}
			callback(null, objects);
		});
	}

	module.sortedSetCount = function (key, min, max, callback) {
		redisClient.zcount(key, min, max, callback);
	};

	module.sortedSetCard = function (key, callback) {
		redisClient.zcard(key, callback);
	};

	module.sortedSetsCard = function (keys, callback) {
		if (Array.isArray(keys) && !keys.length) {
			return callback(null, []);
		}
		var multi = redisClient.multi();
		for(var i = 0; i < keys.length; ++i) {
			multi.zcard(keys[i]);
		}
		multi.exec(callback);
	};

	module.sortedSetRank = function (key, value, callback) {
		redisClient.zrank(key, value, callback);
	};

	module.sortedSetsRanks = function (keys, values, callback) {
		var multi = redisClient.multi();
		for(var i = 0; i < values.length; ++i) {
			multi.zrank(keys[i], values[i]);
		}
		multi.exec(callback);
	};

	module.sortedSetRanks = function (key, values, callback) {
		var multi = redisClient.multi();
		for(var i = 0; i < values.length; ++i) {
			multi.zrank(key, values[i]);
		}
		multi.exec(callback);
	};

	module.sortedSetRevRank = function (key, value, callback) {
		redisClient.zrevrank(key, value, callback);
	};

	module.sortedSetScore = function (key, value, callback) {
		redisClient.zscore(key, value, function (err, score) {
			callback(err, !err ? parseFloat(score) : undefined);
		});
	};

	module.sortedSetsScore = function (keys, value, callback) {
		helpers.multiKeysValue(redisClient, 'zscore', keys, value, callback);
	};

	module.sortedSetScores = function (key, values, callback) {
		helpers.multiKeyValues(redisClient, 'zscore', key, values, callback);
	};

	module.isSortedSetMember = function (key, value, callback) {
		module.sortedSetScore(key, value, function (err, score) {
			callback(err, utils.isNumber(score));
		});
	};

	module.isSortedSetMembers = function (key, values, callback) {
		helpers.multiKeyValues(redisClient, 'zscore', key, values, function (err, results) {
			if (err) {
				return callback(err);
			}
			callback(null, results.map(Boolean));
		});
	};

	module.isMemberOfSortedSets = function (keys, value, callback) {
		helpers.multiKeysValue(redisClient, 'zscore', keys, value, function (err, results) {
			if (err) {
				return callback(err);
			}
			callback(null, results.map(Boolean));
		});
	};

	module.getSortedSetsMembers = function (keys, callback) {
		var multi = redisClient.multi();
		for (var i = 0; i < keys.length; ++i) {
			multi.zrange(keys[i], 0, -1);
		}
		multi.exec(callback);
	};


	module.sortedSetUnionCard = function (keys, callback) {
		var tempSetName = 'temp_' + Date.now();

		var multi = redisClient.multi();
		multi.zunionstore([tempSetName, keys.length].concat(keys));
		multi.zcard(tempSetName);
		multi.del(tempSetName);
		multi.exec(function (err, results) {
			if (err) {
				return callback(err);
			}

			callback(null, Array.isArray(results) && results.length ? results[1] : 0);
		});
	};

	module.getSortedSetUnion = function (params, callback) {
		params.method = 'zrange';
		sortedSetUnion(params, callback);
	};

	module.getSortedSetRevUnion = function (params, callback) {
		params.method = 'zrevrange';
		sortedSetUnion(params, callback);
	};

	function sortedSetUnion(params, callback) {

		var tempSetName = 'temp_' + Date.now();

		var rangeParams = [tempSetName, params.start, params.stop];
		if (params.withScores) {
			rangeParams.push('WITHSCORES');
		}

		var multi = redisClient.multi();
		multi.zunionstore([tempSetName, params.sets.length].concat(params.sets));
		multi[params.method](rangeParams);
		multi.del(tempSetName);
		multi.exec(function (err, results) {
			if (err) {
				return callback(err);
			}
			if (!params.withScores) {
				return callback(null, results ? results[1] : null);
			}
			results = results[1] || [];
			var objects = [];
			for(var i = 0; i < results.length; i += 2) {
				objects.push({value: results[i], score: parseFloat(results[i + 1])});
			}
			callback(null, objects);
		});
	}

	module.sortedSetIncrBy = function (key, increment, value, callback) {
		redisClient.zincrby(key, increment, value, function (err, newValue) {
			callback(err, !err ? parseFloat(newValue) : undefined);
		});
	};

	module.getSortedSetRangeByLex = function (key, min, max, start, count, callback) {
		sortedSetLex('zrangebylex', false, key, min, max, start, count, callback);
	};

	module.getSortedSetRevRangeByLex = function (key, max, min, start, count, callback) {
		sortedSetLex('zrevrangebylex', true, key, max, min, start, count, callback);
	};

	module.sortedSetRemoveRangeByLex = function (key, min, max, callback) {
		callback = callback || helpers.noop;
		sortedSetLex('zremrangebylex', false, key, min, max, function (err) {
			callback(err);
		});
	};

	module.sortedSetLexCount = function (key, min, max, callback) {
		sortedSetLex('zlexcount', false, key, min, max, callback);
	};

	function sortedSetLex(method, reverse, key, min, max, start, count, callback) {
		callback = callback || start;

		var minmin, maxmax;
		if (reverse) {
			minmin = '+';
			maxmax = '-';
		} else {
			minmin = '-';
			maxmax = '+';
		}

		if (min !== minmin) {
			if (!min.match(/^[\[\(]/)) min = '[' + min;
		}
		if (max !== maxmax) {
			if (!max.match(/^[\[\(]/)) max = '[' + max;
		}

		if (count) {
			redisClient[method]([key, min, max, 'LIMIT', start, count], callback);
		} else {
			redisClient[method]([key, min, max], callback);
		}
	}

	module.sortedSetIntersectCard = function (keys, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback(null, 0);
		}
		var tempSetName = 'temp_' + Date.now();

		var interParams = [tempSetName, keys.length].concat(keys);

		var multi = redisClient.multi();
		multi.zinterstore(interParams);
		multi.zcard(tempSetName);
		multi.del(tempSetName);
		multi.exec(function (err, results) {
			if (err) {
				return callback(err);
			}

			callback(null, results[1] || 0);
		});
	};

	module.getSortedSetIntersect = function (params, callback) {
		params.method = 'zrange';
		getSortedSetRevIntersect(params, callback);
	};

	module.getSortedSetRevIntersect = function (params, callback) {
		params.method = 'zrevrange';
		getSortedSetRevIntersect(params, callback);
	};

	function getSortedSetRevIntersect(params, callback) {
		var sets = params.sets;
		var start = params.hasOwnProperty('start') ? params.start : 0;
		var stop = params.hasOwnProperty('stop') ? params.stop : -1;
		var weights = params.weights || [];

		var tempSetName = 'temp_' + Date.now();

		var interParams = [tempSetName, sets.length].concat(sets);
		if (weights.length) {
			interParams = interParams.concat(['WEIGHTS'].concat(weights));
		}

		if (params.aggregate) {
			interParams = interParams.concat(['AGGREGATE', params.aggregate]);
		}

		var rangeParams = [tempSetName, start, stop];
		if (params.withScores) {
			rangeParams.push('WITHSCORES');
		}

		var multi = redisClient.multi();
		multi.zinterstore(interParams);
		multi[params.method](rangeParams);
		multi.del(tempSetName);
		multi.exec(function (err, results) {
			if (err) {
				return callback(err);
			}

			if (!params.withScores) {
				return callback(null, results ? results[1] : null);
			}
			results = results[1] || [];
			var objects = [];
			for(var i = 0; i < results.length; i += 2) {
				objects.push({value: results[i], score: parseFloat(results[i + 1])});
			}
			callback(null, objects);
		});
	}
};
