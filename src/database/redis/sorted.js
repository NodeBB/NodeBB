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
		return await sortedSetRange(key, start, stop, '-inf', '+inf', false, false, false);
	};

	module.getSortedSetRevRange = async function (key, start, stop) {
		return await sortedSetRange(key, start, stop, '-inf', '+inf', false, true, false);
	};

	module.getSortedSetRangeWithScores = async function (key, start, stop) {
		return await sortedSetRange(key, start, stop, '-inf', '+inf', true, false, false);
	};

	module.getSortedSetRevRangeWithScores = async function (key, start, stop) {
		return await sortedSetRange(key, start, stop, '-inf', '+inf', true, true, false);
	};

	module.getSortedSetRangeByScore = async function (key, start, count, min, max) {
		return await sortedSetRangeByScore(key, start, count, min, max, false, false);
	};

	module.getSortedSetRevRangeByScore = async function (key, start, count, max, min) {
		return await sortedSetRangeByScore(key, start, count, max, min, false, true);
	};

	module.getSortedSetRangeByScoreWithScores = async function (key, start, count, min, max) {
		return await sortedSetRangeByScore(key, start, count, min, max, true, false);
	};

	module.getSortedSetRevRangeByScoreWithScores = async function (key, start, count, max, min) {
		return await sortedSetRangeByScore(key, start, count, max, min, true, true);
	};

	async function sortedSetRangeByScore(key, start, count, min, max, withScores, rev) {
		if (parseInt(count, 10) === 0) {
			return [];
		}
		const stop = (parseInt(count, 10) === -1) ? -1 : (start + count - 1);
		return await sortedSetRange(key, start, stop, min, max, withScores, rev, true);
	}

	async function sortedSetRange(key, start, stop, min, max, withScores, rev, byScore) {
		const opts = {};
		const cmd = withScores ? 'zRangeWithScores' : 'zRange';
		if (byScore) {
			opts.BY = 'SCORE';
			opts.LIMIT = { offset: start, count: stop !== -1 ? stop + 1 : stop };
		}
		if (rev) {
			opts.REV = true;
		}

		if (Array.isArray(key)) {
			if (!key.length) {
				return [];
			}
			const batch = module.client.batch();

			if (byScore) {
				key.forEach(key => batch.zRangeWithScores(key, min, max, {
					...opts,
					LIMIT: { offset: 0, count: stop !== -1 ? stop + 1 : stop },
				}));
			} else {
				key.forEach(key => batch.zRangeWithScores(key, 0, stop, { ...opts }));
			}

			const data = await helpers.execBatch(batch);
			const batchData = data;
			let objects = dbHelpers.mergeBatch(batchData, 0, stop, rev ? -1 : 1);
			if (start > 0) {
				objects = objects.slice(start, stop !== -1 ? stop + 1 : undefined);
			}
			if (!withScores) {
				objects = objects.map(item => item.value);
			}
			return objects;
		}

		let data;
		if (byScore) {
			data = await module.client[cmd](key, min, max, opts);
		} else {
			data = await module.client[cmd](key, start, stop, opts);
		}

		if (!withScores) {
			return data;
		}
		return data;
	}

	module.sortedSetCount = async function (key, min, max) {
		return await module.client.zCount(key, min, max);
	};

	module.sortedSetCard = async function (key) {
		return await module.client.zCard(key);
	};

	module.sortedSetsCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const batch = module.client.batch();
		keys.forEach(k => batch.zCard(String(k)));
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
			keys.forEach(k => batch.zCount(String(k), min, max));
		} else {
			keys.forEach(k => batch.zCard(String(k)));
		}
		const counts = await helpers.execBatch(batch);
		return counts.reduce((acc, val) => acc + val, 0);
	};

	module.sortedSetRank = async function (key, value) {
		return await module.client.zRank(key, String(value));
	};

	module.sortedSetRevRank = async function (key, value) {
		return await module.client.zRevRank(key, String(value));
	};

	module.sortedSetsRanks = async function (keys, values) {
		const batch = module.client.batch();
		for (let i = 0; i < values.length; i += 1) {
			batch.zRank(keys[i], String(values[i]));
		}
		return await helpers.execBatch(batch);
	};

	module.sortedSetsRevRanks = async function (keys, values) {
		const batch = module.client.batch();
		for (let i = 0; i < values.length; i += 1) {
			batch.zRevRank(keys[i], String(values[i]));
		}
		return await helpers.execBatch(batch);
	};

	module.sortedSetRanks = async function (key, values) {
		const batch = module.client.batch();
		for (let i = 0; i < values.length; i += 1) {
			batch.zRank(key, String(values[i]));
		}
		return await helpers.execBatch(batch);
	};

	module.sortedSetRevRanks = async function (key, values) {
		const batch = module.client.batch();
		for (let i = 0; i < values.length; i += 1) {
			batch.zRevRank(key, String(values[i]));
		}
		return await helpers.execBatch(batch);
	};

	module.sortedSetScore = async function (key, value) {
		if (!key || value === undefined) {
			return null;
		}
		const score = await module.client.zScore(key, String(value));
		return score === null ? score : parseFloat(score);
	};

	module.sortedSetsScore = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const batch = module.client.batch();
		keys.forEach(key => batch.zScore(String(key), String(value)));
		const scores = await helpers.execBatch(batch);
		return scores.map(d => (d === null ? d : parseFloat(d)));
	};

	module.sortedSetScores = async function (key, values) {
		if (!values.length) {
			return [];
		}
		const batch = module.client.batch();
		values.forEach(value => batch.zScore(String(key), String(value)));
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
		const batch = module.client.multi();
		values.forEach(v => batch.zScore(key, String(v)));
		const results = await batch.execAsPipeline();
		return results.map(utils.isNumber);
	};

	module.isMemberOfSortedSets = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const batch = module.client.multi();
		keys.forEach(k => batch.zScore(k, String(value)));
		const results = await batch.execAsPipeline();
		return results.map(utils.isNumber);
	};

	module.getSortedSetMembers = async function (key) {
		return await module.client.zRange(key, 0, -1);
	};

	module.getSortedSetMembersWithScores = async function (key) {
		return await module.client.zRangeWithScores(key, 0, -1);
	};

	module.getSortedSetsMembers = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const batch = module.client.batch();
		keys.forEach(k => batch.zRange(k, 0, -1));
		return await helpers.execBatch(batch);
	};

	module.getSortedSetsMembersWithScores = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const batch = module.client.batch();
		keys.forEach(k => batch.zRangeWithScores(k, 0, -1));
		const res = await helpers.execBatch(batch);
		return res;
	};

	module.sortedSetIncrBy = async function (key, increment, value) {
		const newValue = await module.client.zIncrBy(key, increment, String(value));
		return parseFloat(newValue);
	};

	module.sortedSetIncrByBulk = async function (data) {
		const multi = module.client.multi();
		data.forEach((item) => {
			multi.zIncrBy(item[0], item[1], String(item[2]));
		});
		const result = await multi.exec();
		return result;
	};

	module.getSortedSetRangeByLex = async function (key, min, max, start = 0, count = -1) {
		const { lmin, lmax } = helpers.normalizeLexRange(min, max, false);
		return await module.client.zRange(key, lmin, lmax, {
			BY: 'LEX',
			LIMIT: { offset: start, count: count },
		});
	};

	module.getSortedSetRevRangeByLex = async function (key, max, min, start = 0, count = -1) {
		const { lmin, lmax } = helpers.normalizeLexRange(max, min, true);
		return await module.client.zRange(key, lmin, lmax, {
			REV: true,
			BY: 'LEX',
			LIMIT: { offset: start, count: count },
		});
	};

	module.sortedSetRemoveRangeByLex = async function (key, min, max) {
		const { lmin, lmax } = helpers.normalizeLexRange(min, max, false);
		await module.client.zRemRangeByLex(key, lmin, lmax);
	};

	module.sortedSetLexCount = async function (key, min, max) {
		const { lmin, lmax } = helpers.normalizeLexRange(min, max, false);
		return await module.client.zLexCount(key, lmin, lmax);
	};

	module.getSortedSetScan = async function (params) {
		let cursor = '0';

		const returnData = [];
		let done = false;
		const seen = Object.create(null);
		do {
			/* eslint-disable no-await-in-loop */
			const res = await module.client.zScan(params.key, cursor, { MATCH: params.match, COUNT: 5000 });
			cursor = res.cursor;
			done = cursor === '0';

			for (let i = 0; i < res.members.length; i ++) {
				const item = res.members[i];
				if (!seen[item.value]) {
					seen[item.value] = 1;

					if (params.withScores) {
						returnData.push({ value: item.value, score: parseFloat(item.score) });
					} else {
						returnData.push(item.value);
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
