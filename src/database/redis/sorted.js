'use strict';

module.exports = function (module) {
	var _ = require('lodash');
	var utils = require('../../utils');
	var helpers = require('./helpers');

	require('./sorted/add')(module);
	require('./sorted/remove')(module);
	require('./sorted/union')(module);
	require('./sorted/intersect')(module);

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
			const batch = module.client.batch();
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

		const data = await module.client.async[method](params);
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
		return await module.client.async.zrangebyscore([key, min, max, 'LIMIT', start, count]);
	};

	module.getSortedSetRevRangeByScore = async function (key, start, count, max, min) {
		return await module.client.async.zrevrangebyscore([key, max, min, 'LIMIT', start, count]);
	};

	module.getSortedSetRangeByScoreWithScores = async function (key, start, count, min, max) {
		return await sortedSetRangeByScoreWithScores('zrangebyscore', key, start, count, min, max);
	};

	module.getSortedSetRevRangeByScoreWithScores = async function (key, start, count, max, min) {
		return await sortedSetRangeByScoreWithScores('zrevrangebyscore', key, start, count, max, min);
	};

	async function sortedSetRangeByScoreWithScores(method, key, start, count, min, max) {
		const data = await module.client.async[method]([key, min, max, 'WITHSCORES', 'LIMIT', start, count]);
		const objects = [];
		for (var i = 0; i < data.length; i += 2) {
			objects.push({ value: data[i], score: parseFloat(data[i + 1]) });
		}
		return objects;
	}

	module.sortedSetCount = async function (key, min, max) {
		return await module.client.async.zcount(key, min, max);
	};

	module.sortedSetCard = async function (key) {
		return await module.client.async.zcard(key);
	};

	module.sortedSetsCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		var batch = module.client.batch();
		keys.forEach(k => batch.zcard(String(k)));
		return await helpers.execBatch(batch);
	};

	module.sortedSetsCardSum = async function (keys) {
		if (!keys || (Array.isArray(keys) && !keys.length)) {
			return 0;
		}
		if (!Array.isArray(keys)) {
			keys = [keys];
		}
		const counts = await module.sortedSetsCard(keys);
		const sum = counts.reduce((acc, val) => acc + val, 0);
		return sum;
	};

	module.sortedSetRank = async function (key, value) {
		return await module.client.async.zrank(key, value);
	};

	module.sortedSetRevRank = async function (key, value) {
		return await module.client.async.zrevrank(key, value);
	};

	module.sortedSetsRanks = async function (keys, values) {
		const batch = module.client.batch();
		for (var i = 0; i < values.length; i += 1) {
			batch.zrank(keys[i], String(values[i]));
		}
		return await helpers.execBatch(batch);
	};

	module.sortedSetsRevRanks = async function (keys, values) {
		const batch = module.client.batch();
		for (var i = 0; i < values.length; i += 1) {
			batch.zrevrank(keys[i], String(values[i]));
		}
		return await helpers.execBatch(batch);
	};

	module.sortedSetRanks = async function (key, values) {
		const batch = module.client.batch();
		for (var i = 0; i < values.length; i += 1) {
			batch.zrank(key, String(values[i]));
		}
		return await helpers.execBatch(batch);
	};

	module.sortedSetRevRanks = async function (key, values) {
		const batch = module.client.batch();
		for (var i = 0; i < values.length; i += 1) {
			batch.zrevrank(key, String(values[i]));
		}
		return await helpers.execBatch(batch);
	};

	module.sortedSetScore = async function (key, value) {
		if (!key || value === undefined) {
			return null;
		}

		const score = await module.client.async.zscore(key, value);
		return score === null ? score : parseFloat(score);
	};

	module.sortedSetsScore = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const batch = module.client.batch();
		keys.forEach(key => batch.zscore(String(key), String(value)));
		const scores = await helpers.execBatch(batch);
		return scores.map(d => (d === null ? d : parseFloat(d)));
	};

	module.sortedSetScores = async function (key, values) {
		if (!values.length) {
			return [];
		}
		const batch = module.client.batch();
		values.forEach(value => batch.zscore(String(key), String(value)));
		const scores = await helpers.execBatch(batch);
		return scores.map(d => (d === null ? d : parseFloat(d)));
	};

	module.isSortedSetMember = async function (key, value) {
		const score = await module.sortedSetScore(key, value);
		return utils.isNumber(score);
	};

	module.isSortedSetMembers = async function (key, values) {
		const batch = module.client.batch();
		values.forEach(v => batch.zscore(key, String(v)));
		const results = await helpers.execBatch(batch);
		return results.map(utils.isNumber);
	};

	module.isMemberOfSortedSets = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const batch = module.client.batch();
		keys.forEach(k => batch.zscore(k, String(value)));
		const results = await helpers.execBatch(batch);
		return results.map(utils.isNumber);
	};

	module.getSortedSetsMembers = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		var batch = module.client.batch();
		keys.forEach(k => batch.zrange(k, 0, -1));
		return await helpers.execBatch(batch);
	};

	module.sortedSetIncrBy = async function (key, increment, value) {
		const newValue = await module.client.async.zincrby(key, increment, value);
		return parseFloat(newValue);
	};

	module.getSortedSetRangeByLex = async function (key, min, max, start, count) {
		return await sortedSetLex('zrangebylex', false, key, min, max, start, count);
	};

	module.getSortedSetRevRangeByLex = async function (key, max, min, start, count) {
		return await sortedSetLex('zrevrangebylex', true, key, max, min, start, count);
	};

	module.sortedSetRemoveRangeByLex = async function (key, min, max) {
		await sortedSetLex('zremrangebylex', false, key, min, max);
	};

	module.sortedSetLexCount = async function (key, min, max) {
		return await sortedSetLex('zlexcount', false, key, min, max);
	};

	async function sortedSetLex(method, reverse, key, min, max, start, count) {
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
		const args = [key, min, max];
		if (count) {
			args.push('LIMIT', start, count);
		}
		return await module.client.async[method](args);
	}
};
