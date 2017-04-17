
'use strict';

module.exports = function (redisClient, module) {
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
			for (var i = 0; i < results.length; i += 2) {
				objects.push({ value: results[i], score: parseFloat(results[i + 1]) });
			}
			callback(null, objects);
		});
	}
};
