'use strict';

module.exports = function (module) {
	const utils = require('../../utils');
	const helpers = require('./helpers');
	const dbHelpers = require('../helpers');

	require('./sorted/add')(module);
	require('./sorted/remove')(module);
	require('./sorted/union')(module);
	require('./sorted/intersect')(module);

	module.getSortedSetRange = async function (key, start, stop) {
		return await sortedSetRange('zrange', key, start, stop, '-inf', '+inf', false);
	};

	module.getSortedSetRevRange = async function (key, start, stop) {
		return await sortedSetRange('zrevrange', key, start, stop, '-inf', '+inf', false);
	};

	module.getSortedSetRangeWithScores = async function (key, start, stop) {
		return await sortedSetRange('zrange', key, start, stop, '-inf', '+inf', true);
	};

	module.getSortedSetRevRangeWithScores = async function (key, start, stop) {
		return await sortedSetRange('zrevrange', key, start, stop, '-inf', '+inf', true);
	};

	async function sortedSetRange(method, key, start, stop, min, max, withScores) {
		if (Array.isArray(key)) {
			if (!key.length) {
				return [];
			}
			const batch = module.client.batch();
			key.forEach(key => batch[method](genParams(method, key, 0, stop, min, max, true)));
			const data = await helpers.execBatch(batch);

			const batchData = data.map(setData => helpers.zsetToObjectArray(setData));

			let objects = dbHelpers.mergeBatch(batchData, 0, stop, method === 'zrange' ? 1 : -1);

			if (start > 0) {
				objects = objects.slice(start, stop !== -1 ? stop + 1 : undefined);
			}
			if (!withScores) {
				objects = objects.map(item => item.value);
			}
			return objects;
		}

		const params = genParams(method, key, start, stop, min, max, withScores);
		const data = await module.client[method](params);
		if (!withScores) {
			return data;
		}
		const objects = helpers.zsetToObjectArray(data);
		return objects;
	}

	function genParams(method, key, start, stop, min, max, withScores) {
		const params = {
			zrevrange: [key, start, stop],
			zrange: [key, start, stop],
			zrangebyscore: [key, min, max],
			zrevrangebyscore: [key, max, min],
		};
		if (withScores) {
			params[method].push('WITHSCORES');
		}

		if (method === 'zrangebyscore' || method === 'zrevrangebyscore') {
			const count = stop !== -1 ? stop - start + 1 : stop;
			params[method].push('LIMIT', start, count);
		}
		return params[method];
	}

	module.getSortedSetRangeByScore = async function (key, start, count, min, max) {
		return await sortedSetRangeByScore('zrangebyscore', key, start, count, min, max, false);
	};

	module.getSortedSetRevRangeByScore = async function (key, start, count, max, min) {
		return await sortedSetRangeByScore('zrevrangebyscore', key, start, count, min, max, false);
	};

	module.getSortedSetRangeByScoreWithScores = async function (key, start, count, min, max) {
		return await sortedSetRangeByScore('zrangebyscore', key, start, count, min, max, true);
	};

	module.getSortedSetRevRangeByScoreWithScores = async function (key, start, count, max, min) {
		return await sortedSetRangeByScore('zrevrangebyscore', key, start, count, min, max, true);
	};

	async function sortedSetRangeByScore(method, key, start, count, min, max, withScores) {
		if (parseInt(count, 10) === 0) {
			return [];
		}
		const stop = (parseInt(count, 10) === -1) ? -1 : (start + count - 1);
		return await sortedSetRange(method, key, start, stop, min, max, withScores);
	}

	module.sortedSetCount = async function (key, min, max) {
		return await module.client.zcount(key, min, max);
	};

	module.sortedSetCard = async function (key) {
		return await module.client.zcard(key);
	};

	module.sortedSetsCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const batch = module.client.batch();
		keys.forEach(k => batch.zcard(String(k)));
		return await helpers.execBatch(batch);
	};

	module.sortedSetsCardSum = async function (keys, min = '-inf', max = '+inf') {
		if (!keys || (Array.isArray(keys) && !keys.length)) {
			return 0;
		}
		if (!Array.isArray(keys)) {
			keys = [keys];
		}
		const batch = module.client.batch();
		if (min !== '-inf' || max !== '+inf') {
			keys.forEach(k => batch.zcount(String(k), min, max));
		} else {
			keys.forEach(k => batch.zcard(String(k)));
		}
		const counts = await helpers.execBatch(batch);
		return counts.reduce((acc, val) => acc + val, 0);
	};

	module.sortedSetRank = async function (key, value) {
		return await module.client.zrank(key, value);
	};

	module.sortedSetRevRank = async function (key, value) {
		return await module.client.zrevrank(key, value);
	};

	module.sortedSetsRanks = async function (keys, values) {
		const batch = module.client.batch();
		for (let i = 0; i < values.length; i += 1) {
			batch.zrank(keys[i], String(values[i]));
		}
		return await helpers.execBatch(batch);
	};

	module.sortedSetsRevRanks = async function (keys, values) {
		const batch = module.client.batch();
		for (let i = 0; i < values.length; i += 1) {
			batch.zrevrank(keys[i], String(values[i]));
		}
		return await helpers.execBatch(batch);
	};

	module.sortedSetRanks = async function (key, values) {
		const batch = module.client.batch();
		for (let i = 0; i < values.length; i += 1) {
			batch.zrank(key, String(values[i]));
		}
		return await helpers.execBatch(batch);
	};

	module.sortedSetRevRanks = async function (key, values) {
		const batch = module.client.batch();
		for (let i = 0; i < values.length; i += 1) {
			batch.zrevrank(key, String(values[i]));
		}
		return await helpers.execBatch(batch);
	};

	module.sortedSetScore = async function (key, value) {
		if (!key || value === undefined) {
			return null;
		}

		const score = await module.client.zscore(key, value);
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
		if (!values.length) {
			return [];
		}
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

	module.getSortedSetMembers = async function (key) {
		return await module.client.zrange(key, 0, -1);
	};

	module.getSortedSetMembersWithScores = async function (key) {
		return helpers.zsetToObjectArray(
			await module.client.zrange(key, 0, -1, 'WITHSCORES')
		);
	};

	module.getSortedSetsMembers = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const batch = module.client.batch();
		keys.forEach(k => batch.zrange(k, 0, -1));
		return await helpers.execBatch(batch);
	};

	module.getSortedSetsMembersWithScores = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const batch = module.client.batch();
		keys.forEach(k => batch.zrange(k, 0, -1, 'WITHSCORES'));
		const res = await helpers.execBatch(batch);
		return res.map(helpers.zsetToObjectArray);
	};

	module.sortedSetIncrBy = async function (key, increment, value) {
		const newValue = await module.client.zincrby(key, increment, value);
		return parseFloat(newValue);
	};

	module.sortedSetIncrByBulk = async function (data) {
		const multi = module.client.multi();
		data.forEach((item) => {
			multi.zincrby(item[0], item[1], item[2]);
		});
		const result = await multi.exec();
		return result.map(item => item && parseFloat(item[1]));
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
		let minmin;
		let maxmax;
		if (reverse) {
			minmin = '+';
			maxmax = '-';
		} else {
			minmin = '-';
			maxmax = '+';
		}

		if (min !== minmin && !min.match(/^[[(]/)) {
			min = `[${min}`;
		}
		if (max !== maxmax && !max.match(/^[[(]/)) {
			max = `[${max}`;
		}
		const args = [key, min, max];
		if (count) {
			args.push('LIMIT', start, count);
		}
		return await module.client[method](args);
	}

	module.getSortedSetScan = async function (params) {
		let cursor = '0';

		const returnData = [];
		let done = false;
		const seen = Object.create(null);
		do {
			/* eslint-disable no-await-in-loop */
			const res = await module.client.zscan(params.key, cursor, 'MATCH', params.match, 'COUNT', 5000);
			cursor = res[0];
			done = cursor === '0';
			const data = res[1];

			for (let i = 0; i < data.length; i += 2) {
				const value = data[i];
				if (!seen[value]) {
					seen[value] = 1;

					if (params.withScores) {
						returnData.push({ value: value, score: parseFloat(data[i + 1]) });
					} else {
						returnData.push(value);
					}
					if (params.limit && returnData.length >= params.limit) {
						done = true;
						break;
					}
				}
			}
		} while (!done);

		return returnData;
	};
};
