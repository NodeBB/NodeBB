'use strict';

module.exports = function (redisClient, module) {
	var _ = require('lodash');
	var utils = require('../../utils');

	var helpers = module.helpers.redis;

	require('./sorted/add')(redisClient, module);
	require('./sorted/remove')(redisClient, module);
	require('./sorted/union')(redisClient, module);
	require('./sorted/intersect')(redisClient, module);

	module.getSortedSetRange = async function (key, start, stop) {
		return await sortedSetRange('zrange', key, start, stop, false);
	};

	module.getSortedSetRevRange = async function (key, start, stop) {
		return await sortedSetRange('zrevrange', key, start, stop, false);
	};

	module.getSortedSetRangeWithScores = async function (key, start, stop) {
		return await sortedSetRange('zrange', key, start, stop, true);
	};

	module.getSortedSetRevRangeWithScores = async function (key, start, stop) {
		return await sortedSetRange('zrevrange', key, start, stop, true);
	};

	async function sortedSetRange(method, key, start, stop, withScores) {
		if (Array.isArray(key)) {
			if (!key.length) {
				return [];
			}
			const batch = redisClient.batch();
			key.forEach((key) => {
				batch[method]([key, start, stop, 'WITHSCORES']);
			});
			let data = await helpers.execBatch(batch);
			data = _.flatten(data);
			let objects = [];
			for (let i = 0; i < data.length; i += 2) {
				objects.push({ value: data[i], score: parseFloat(data[i + 1]) });
			}

			objects.sort((a, b) => {
				if (method === 'zrange') {
					return a.score - b.score;
				}
				return b.score - a.score;
			});
			if (!withScores) {
				objects = objects.map(item => item.value);
			}
			return objects;
		}

		var params = [key, start, stop];
		if (withScores) {
			params.push('WITHSCORES');
		}

		const data = await redisClient.async[method](params);
		if (!withScores) {
			return data;
		}
		const objects = [];
		for (var i = 0; i < data.length; i += 2) {
			objects.push({ value: data[i], score: parseFloat(data[i + 1]) });
		}
		return objects;
	}

	module.getSortedSetRangeByScore = async function (key, start, count, min, max) {
		return await redisClient.async.zrangebyscore([key, min, max, 'LIMIT', start, count]);
	};

	module.getSortedSetRevRangeByScore = async function (key, start, count, max, min) {
		return await redisClient.async.zrevrangebyscore([key, max, min, 'LIMIT', start, count]);
	};

	module.getSortedSetRangeByScoreWithScores = async function (key, start, count, min, max) {
		return await sortedSetRangeByScoreWithScores('zrangebyscore', key, start, count, min, max);
	};

	module.getSortedSetRevRangeByScoreWithScores = async function (key, start, count, max, min) {
		return await sortedSetRangeByScoreWithScores('zrevrangebyscore', key, start, count, max, min);
	};

	async function sortedSetRangeByScoreWithScores(method, key, start, count, min, max) {
		const data = await redisClient.async[method]([key, min, max, 'WITHSCORES', 'LIMIT', start, count]);
		const objects = [];
		for (var i = 0; i < data.length; i += 2) {
			objects.push({ value: data[i], score: parseFloat(data[i + 1]) });
		}
		return objects;
	}

	module.sortedSetCount = function (key, min, max, callback) {
		redisClient.zcount(key, min, max, callback);
	};

	module.sortedSetCard = function (key, callback) {
		redisClient.zcard(key, callback);
	};

	module.sortedSetsCard = function (keys, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return callback(null, []);
		}
		var batch = redisClient.batch();
		for (var i = 0; i < keys.length; i += 1) {
			batch.zcard(keys[i]);
		}
		batch.exec(callback);
	};

	module.sortedSetsCardSum = function (keys, callback) {
		if (!keys || (Array.isArray(keys) && !keys.length)) {
			return callback(null, 0);
		}
		if (!Array.isArray(keys)) {
			keys = [keys];
		}
		module.sortedSetsCard(keys, function (err, counts) {
			if (err) {
				return callback(err);
			}
			const sum = counts.reduce(function (acc, val) { return acc + val; }, 0);
			callback(null, sum);
		});
	};

	module.sortedSetRank = function (key, value, callback) {
		redisClient.zrank(key, value, callback);
	};

	module.sortedSetRevRank = function (key, value, callback) {
		redisClient.zrevrank(key, value, callback);
	};

	module.sortedSetsRanks = function (keys, values, callback) {
		var batch = redisClient.batch();
		for (var i = 0; i < values.length; i += 1) {
			batch.zrank(keys[i], values[i]);
		}
		batch.exec(callback);
	};

	module.sortedSetsRevRanks = function (keys, values, callback) {
		var batch = redisClient.batch();
		for (var i = 0; i < values.length; i += 1) {
			batch.zrevrank(keys[i], values[i]);
		}
		batch.exec(callback);
	};

	module.sortedSetRanks = function (key, values, callback) {
		var batch = redisClient.batch();
		for (var i = 0; i < values.length; i += 1) {
			batch.zrank(key, values[i]);
		}
		batch.exec(callback);
	};

	module.sortedSetRevRanks = function (key, values, callback) {
		var batch = redisClient.batch();
		for (var i = 0; i < values.length; i += 1) {
			batch.zrevrank(key, values[i]);
		}
		batch.exec(callback);
	};

	module.sortedSetScore = async function (key, value) {
		if (!key || value === undefined) {
			return null;
		}

		const score = await redisClient.async.zscore(key, value);
		return score === null ? score : parseFloat(score);
	};

	module.sortedSetsScore = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const batch = redisClient.batch();
		keys.forEach(key => batch.zscore(String(key), String(value)));
		const scores = await helpers.execBatch(batch);
		return scores.map(d => (d === null ? d : parseFloat(d)));
	};

	module.sortedSetScores = async function (key, values) {
		if (!values.length) {
			return [];
		}
		const batch = redisClient.batch();
		values.forEach(value => batch.zscore(String(key), String(value)));
		const scores = await helpers.execBatch(batch);
		return scores.map(d => (d === null ? d : parseFloat(d)));
	};

	module.isSortedSetMember = function (key, value, callback) {
		module.sortedSetScore(key, value, function (err, score) {
			callback(err, utils.isNumber(score));
		});
	};

	module.isSortedSetMembers = function (key, values, callback) {
		helpers.execKeyValues(redisClient, 'batch', 'zscore', key, values, function (err, results) {
			if (err) {
				return callback(err);
			}
			callback(null, results.map(Boolean));
		});
	};

	module.isMemberOfSortedSets = function (keys, value, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return setImmediate(callback, null, []);
		}
		helpers.execKeysValue(redisClient, 'batch', 'zscore', keys, value, function (err, results) {
			if (err) {
				return callback(err);
			}
			callback(null, results.map(Boolean));
		});
	};

	module.getSortedSetsMembers = function (keys, callback) {
		if (!Array.isArray(keys) || !keys.length) {
			return setImmediate(callback, null, []);
		}
		var batch = redisClient.batch();
		for (var i = 0; i < keys.length; i += 1) {
			batch.zrange(keys[i], 0, -1);
		}
		batch.exec(callback);
	};

	module.sortedSetIncrBy = function (key, increment, value, callback) {
		callback = callback || helpers.noop;
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

		var minmin;
		var maxmax;
		if (reverse) {
			minmin = '+';
			maxmax = '-';
		} else {
			minmin = '-';
			maxmax = '+';
		}

		if (min !== minmin && !min.match(/^[[(]/)) {
			min = '[' + min;
		}
		if (max !== maxmax && !max.match(/^[[(]/)) {
			max = '[' + max;
		}

		if (count) {
			redisClient[method]([key, min, max, 'LIMIT', start, count], callback);
		} else {
			redisClient[method]([key, min, max], callback);
		}
	}
};
