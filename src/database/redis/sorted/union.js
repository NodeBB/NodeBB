
'use strict';

module.exports = function (redisClient, module) {
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
		module.sortedSetUnion(params, callback);
	};

	module.getSortedSetRevUnion = function (params, callback) {
		params.method = 'zrevrange';
		module.sortedSetUnion(params, callback);
	};

	module.sortedSetUnion = function (params, callback) {
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
			for (var i = 0; i < results.length; i += 2) {
				objects.push({ value: results[i], score: parseFloat(results[i + 1]) });
			}
			callback(null, objects);
		});
	};
};
