'use strict';

module.exports = function (redisClient, module) {
	const utils = require('../../../utils');

	module.sortedSetAdd = function (key, score, value, callback) {
		callback = callback || function () {};
		if (!key) {
			return setImmediate(callback);
		}
		if (Array.isArray(score) && Array.isArray(value)) {
			return sortedSetAddMulti(key, score, value, callback);
		}
		if (!utils.isNumber(score)) {
			return setImmediate(callback, new Error('[[error:invalid-score, ' + score + ']]'));
		}
		redisClient.zadd(key, score, String(value), function (err) {
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
		for (let i = 0; i < scores.length; i += 1) {
			if (!utils.isNumber(scores[i])) {
				return setImmediate(callback, new Error('[[error:invalid-score, ' + scores[i] + ']]'));
			}
		}
		var args = [key];

		for (var i = 0; i < scores.length; i += 1) {
			args.push(scores[i], String(values[i]));
		}

		redisClient.zadd(args, function (err) {
			callback(err);
		});
	}

	module.sortedSetsAdd = function (keys, scores, value, callback) {
		callback = callback || function () {};
		if (!Array.isArray(keys) || !keys.length) {
			return setImmediate(callback);
		}
		const isArrayOfScores = Array.isArray(scores);
		if (!isArrayOfScores && !utils.isNumber(scores)) {
			return setImmediate(callback, new Error('[[error:invalid-score, ' + scores + ']]'));
		}

		if (isArrayOfScores && scores.length !== keys.length) {
			return setImmediate(callback, new Error('[[error:invalid-data]]'));
		}

		var batch = redisClient.batch();

		for (var i = 0; i < keys.length; i += 1) {
			if (keys[i]) {
				batch.zadd(keys[i], isArrayOfScores ? scores[i] : scores, String(value));
			}
		}

		batch.exec(function (err) {
			callback(err);
		});
	};
};
