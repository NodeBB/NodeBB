'use strict';

const _ = require('lodash');
const utils = require('../../utils');

module.exports = function (module) {
	const helpers = require('./helpers');
	const dbHelpers = require('../helpers');

	const util = require('util');
	const sleep = util.promisify(setTimeout);

	require('./sorted/add')(module);
	require('./sorted/remove')(module);
	require('./sorted/union')(module);
	require('./sorted/intersect')(module);

	module.getSortedSetRange = async function (key, start, stop) {
		return await getSortedSetRange(key, start, stop, '-inf', '+inf', 1, false);
	};

	module.getSortedSetRevRange = async function (key, start, stop) {
		return await getSortedSetRange(key, start, stop, '-inf', '+inf', -1, false);
	};

	module.getSortedSetRangeWithScores = async function (key, start, stop) {
		return await getSortedSetRange(key, start, stop, '-inf', '+inf', 1, true);
	};

	module.getSortedSetRevRangeWithScores = async function (key, start, stop) {
		return await getSortedSetRange(key, start, stop, '-inf', '+inf', -1, true);
	};

	async function getSortedSetRange(key, start, stop, min, max, sort, withScores) {
		if (!key) {
			return;
		}
		const isArray = Array.isArray(key);
		if ((start < 0 && start > stop) || (isArray && !key.length)) {
			return [];
		}
		const query = { _key: key };
		if (isArray) {
			if (key.length > 1) {
				query._key = { $in: key };
			} else {
				query._key = key[0];
			}
		}

		if (min !== '-inf') {
			query.score = { $gte: parseFloat(min) };
		}
		if (max !== '+inf') {
			query.score = query.score || {};
			query.score.$lte = parseFloat(max);
		}

		if (max === min) {
			query.score = parseFloat(max);
		}

		const fields = { _id: 0, _key: 0 };
		if (!withScores) {
			fields.score = 0;
		}

		let reverse = false;
		if (start === 0 && stop < -1) {
			reverse = true;
			sort *= -1;
			start = Math.abs(stop + 1);
			stop = -1;
		} else if (start < 0 && stop > start) {
			const tmp1 = Math.abs(stop + 1);
			stop = Math.abs(start + 1);
			start = tmp1;
		}

		let limit = stop - start + 1;
		if (limit <= 0) {
			limit = 0;
		}

		let result = [];
		async function doQuery(_key, fields, skip, limit) {
			return await module.client.collection('objects').find({
				...query, ...{ _key: _key },
			}, { projection: fields })
				.sort({ score: sort })
				.skip(skip)
				.limit(limit)
				.toArray();
		}

		if (isArray && key.length > 100) {
			const batches = [];
			const batch = require('../../batch');
			const batchSize = Math.ceil(key.length / Math.ceil(key.length / 100));
			await batch.processArray(key, async currentBatch => batches.push(currentBatch), { batch: batchSize });
			const batchData = await Promise.all(batches.map(
				batch => doQuery({ $in: batch }, { _id: 0, _key: 0 }, 0, stop + 1)
			));
			result = dbHelpers.mergeBatch(batchData, 0, stop, sort);
			if (start > 0) {
				result = result.slice(start, stop !== -1 ? stop + 1 : undefined);
			}
		} else {
			result = await doQuery(query._key, fields, start, limit);
		}

		if (reverse) {
			result.reverse();
		}
		if (!withScores) {
			result = result.map(item => item.value);
		}

		return result;
	}

	module.getSortedSetRangeByScore = async function (key, start, count, min, max) {
		return await getSortedSetRangeByScore(key, start, count, min, max, 1, false);
	};

	module.getSortedSetRevRangeByScore = async function (key, start, count, max, min) {
		return await getSortedSetRangeByScore(key, start, count, min, max, -1, false);
	};

	module.getSortedSetRangeByScoreWithScores = async function (key, start, count, min, max) {
		return await getSortedSetRangeByScore(key, start, count, min, max, 1, true);
	};

	module.getSortedSetRevRangeByScoreWithScores = async function (key, start, count, max, min) {
		return await getSortedSetRangeByScore(key, start, count, min, max, -1, true);
	};

	async function getSortedSetRangeByScore(key, start, count, min, max, sort, withScores) {
		if (parseInt(count, 10) === 0) {
			return [];
		}
		const stop = (parseInt(count, 10) === -1) ? -1 : (start + count - 1);
		return await getSortedSetRange(key, start, stop, min, max, sort, withScores);
	}

	module.sortedSetCount = async function (key, min, max) {
		if (!key) {
			return;
		}

		const query = { _key: key };
		if (min !== '-inf') {
			query.score = { $gte: min };
		}
		if (max !== '+inf') {
			query.score = query.score || {};
			query.score.$lte = max;
		}

		return await module.client.collection('objects').countDocuments(query);
	};

	module.sortedSetCard = async function (key) {
		if (!key) {
			return 0;
		}
		return await module.client.collection('objects').countDocuments({ _key: key });
	};

	module.sortedSetsCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		return await Promise.all(keys.map(module.sortedSetCard));
	};

	module.sortedSetsCardSum = async function (keys, min = '-inf', max = '+inf') {
		const isArray = Array.isArray(keys);
		if (!keys || (isArray && !keys.length)) {
			return 0;
		}

		const query = { _key: isArray ? { $in: keys } : keys };
		if (min !== '-inf') {
			query.score = { $gte: min };
		}
		if (max !== '+inf') {
			query.score = query.score || {};
			query.score.$lte = max;
		}

		return await module.client.collection('objects').countDocuments(query);
	};

	module.sortedSetRank = async function (key, value) {
		return await getSortedSetRank(false, key, value);
	};

	module.sortedSetRevRank = async function (key, value) {
		return await getSortedSetRank(true, key, value);
	};

	async function getSortedSetRank(reverse, key, value) {
		if (!key) {
			return;
		}
		value = helpers.valueToString(value);
		const score = await module.sortedSetScore(key, value);
		if (score === null) {
			return null;
		}

		return await module.client.collection('objects').countDocuments({
			$or: [
				{
					_key: key,
					score: reverse ? { $gt: score } : { $lt: score },
				},
				{
					_key: key,
					score: score,
					value: reverse ? { $gt: value } : { $lt: value },
				},
			],
		});
	}

	module.sortedSetsRanks = async function (keys, values) {
		return await sortedSetsRanks(module.sortedSetRank, keys, values);
	};

	module.sortedSetsRevRanks = async function (keys, values) {
		return await sortedSetsRanks(module.sortedSetRevRank, keys, values);
	};

	async function sortedSetsRanks(method, keys, values) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const data = new Array(values.length);
		for (let i = 0; i < values.length; i += 1) {
			data[i] = { key: keys[i], value: values[i] };
		}
		const promises = data.map(item => method(item.key, item.value));
		return await Promise.all(promises);
	}

	module.sortedSetRanks = async function (key, values) {
		return await sortedSetRanks(false, key, values);
	};

	module.sortedSetRevRanks = async function (key, values) {
		return await sortedSetRanks(true, key, values);
	};

	async function sortedSetRanks(reverse, key, values) {
		if (values.length === 1) {
			return [await getSortedSetRank(reverse, key, values[0])];
		}
		const sortedSet = await module[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](key, 0, -1);
		return values.map((value) => {
			if (!value) {
				return null;
			}
			const index = sortedSet.indexOf(value.toString());
			return index !== -1 ? index : null;
		});
	}

	module.sortedSetScore = async function (key, value) {
		if (!key) {
			return null;
		}
		value = helpers.valueToString(value);
		const result = await module.client.collection('objects').findOne({ _key: key, value: value }, { projection: { _id: 0, _key: 0, value: 0 } });
		return result ? result.score : null;
	};

	module.sortedSetsScore = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		value = helpers.valueToString(value);
		const result = await module.client.collection('objects').find({ _key: { $in: keys }, value: value }, { projection: { _id: 0, value: 0 } }).toArray();
		const map = {};
		result.forEach((item) => {
			if (item) {
				map[item._key] = item;
			}
		});

		return keys.map(key => (map[key] ? map[key].score : null));
	};

	module.sortedSetScores = async function (key, values) {
		if (!key) {
			return null;
		}
		if (!values.length) {
			return [];
		}
		values = values.map(helpers.valueToString);
		const result = await module.client.collection('objects').find({ _key: key, value: { $in: values } }, { projection: { _id: 0, _key: 0 } }).toArray();

		const valueToScore = {};
		result.forEach((item) => {
			if (item) {
				valueToScore[item.value] = item.score;
			}
		});

		return values.map(v => (utils.isNumber(valueToScore[v]) ? valueToScore[v] : null));
	};

	module.isSortedSetMember = async function (key, value) {
		if (!key) {
			return;
		}
		value = helpers.valueToString(value);
		const result = await module.client.collection('objects').findOne({
			_key: key, value: value,
		}, {
			projection: { _id: 0, value: 1 },
		});
		return !!result;
	};

	module.isSortedSetMembers = async function (key, values) {
		if (!key) {
			return;
		}
		if (!values.length) {
			return [];
		}
		values = values.map(helpers.valueToString);
		const results = await module.client.collection('objects').find({
			_key: key, value: { $in: values },
		}, {
			projection: { _id: 0, value: 1 },
		}).toArray();

		const isMember = {};
		results.forEach((item) => {
			if (item) {
				isMember[item.value] = true;
			}
		});

		return values.map(value => !!isMember[value]);
	};

	module.isMemberOfSortedSets = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		value = helpers.valueToString(value);
		const results = await module.client.collection('objects').find({
			_key: { $in: keys }, value: value,
		}, {
			projection: { _id: 0, _key: 1, value: 1 },
		}).toArray();

		const isMember = {};
		results.forEach((item) => {
			if (item) {
				isMember[item._key] = true;
			}
		});

		return keys.map(key => !!isMember[key]);
	};

	module.getSortedSetMembers = async function (key) {
		const data = await getSortedSetsMembersWithScores([key], false);
		return data && data[0];
	};

	module.getSortedSetMembersWithScores = async function (key) {
		const data = await getSortedSetsMembersWithScores([key], true);
		return data && data[0];
	};

	module.getSortedSetsMembers = async function (keys) {
		return await getSortedSetsMembersWithScores(keys, false);
	};

	module.getSortedSetsMembersWithScores = async function (keys) {
		return await getSortedSetsMembersWithScores(keys, true);
	};

	async function getSortedSetsMembersWithScores(keys, withScores) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const arrayOfKeys = keys.length > 1;
		const projection = { _id: 0, value: 1 };
		if (withScores) {
			projection.score = 1;
		}
		if (arrayOfKeys) {
			projection._key = 1;
		}
		const data = await module.client.collection('objects').find({
			_key: arrayOfKeys ? { $in: keys } : keys[0],
		}, { projection: projection })
			.sort({ score: 1 })
			.toArray();

		if (!arrayOfKeys) {
			return [withScores ?
				data.map(i => ({ value: i.value, score: i.score })) :
				data.map(item => item.value),
			];
		}
		const sets = {};
		data.forEach((item) => {
			sets[item._key] = sets[item._key] || [];
			if (withScores) {
				sets[item._key].push({ value: item.value, score: item.score });
			} else {
				sets[item._key].push(item.value);
			}
		});

		return keys.map(k => sets[k] || []);
	}

	module.sortedSetIncrBy = async function (key, increment, value) {
		if (!key) {
			return;
		}
		const data = {};
		value = helpers.valueToString(value);
		data.score = parseFloat(increment);

		try {
			const result = await module.client.collection('objects').findOneAndUpdate({
				_key: key,
				value: value,
			}, {
				$inc: data,
			}, {
				returnDocument: 'after',
				includeResultMetadata: true,
				upsert: true,
			});
			return result && result.value ? result.value.score : null;
		} catch (err) {
			// if there is duplicate key error retry the upsert
			// https://github.com/NodeBB/NodeBB/issues/4467
			// https://jira.mongodb.org/browse/SERVER-14322
			// https://docs.mongodb.org/manual/reference/command/findAndModify/#upsert-and-unique-index
			if (err && err.message.includes('E11000 duplicate key error')) {
				console.log(new Error('e11000').stack, key, increment, value);
				return await module.sortedSetIncrBy(key, increment, value);
			}
			throw err;
		}
	};

	module.sortedSetIncrByBulk = async function (data) {
		const bulk = module.client.collection('objects').initializeUnorderedBulkOp();
		data.forEach((item) => {
			bulk.find({ _key: item[0], value: helpers.valueToString(item[2]) })
				.upsert()
				.update({ $inc: { score: parseFloat(item[1]) } });
		});
		await bulk.execute();
		const result = await module.client.collection('objects').find({
			_key: { $in: _.uniq(data.map(i => i[0])) },
			value: { $in: _.uniq(data.map(i => i[2])) },
		}, {
			projection: { _id: 0, _key: 1, value: 1, score: 1 },
		}).toArray();

		const map = {};
		result.forEach((item) => {
			map[`${item._key}:${item.value}`] = item.score;
		});
		return data.map(item => map[`${item[0]}:${item[2]}`]);
	};

	module.getSortedSetRangeByLex = async function (key, min, max, start, count) {
		return await sortedSetLex(key, min, max, 1, start, count);
	};

	module.getSortedSetRevRangeByLex = async function (key, max, min, start, count) {
		return await sortedSetLex(key, min, max, -1, start, count);
	};

	module.sortedSetLexCount = async function (key, min, max) {
		const data = await sortedSetLex(key, min, max, 1, 0, 0);
		return data ? data.length : null;
	};

	async function sortedSetLex(key, min, max, sort, start, count) {
		const query = { _key: key };
		start = start !== undefined ? start : 0;
		count = count !== undefined ? count : 0;
		buildLexQuery(query, min, max);

		const data = await module.client.collection('objects').find(query, { projection: { _id: 0, value: 1 } })
			.sort({ value: sort })
			.skip(start)
			.limit(count === -1 ? 0 : count)
			.toArray();

		return data.map(item => item && item.value);
	}

	module.sortedSetRemoveRangeByLex = async function (key, min, max) {
		const query = { _key: key };
		buildLexQuery(query, min, max);

		await module.client.collection('objects').deleteMany(query);
	};

	function buildLexQuery(query, min, max) {
		if (min !== '-') {
			if (min.match(/^\(/)) {
				query.value = { $gt: min.slice(1) };
			} else if (min.match(/^\[/)) {
				query.value = { $gte: min.slice(1) };
			} else {
				query.value = { $gte: min };
			}
		}
		if (max !== '+') {
			query.value = query.value || {};
			if (max.match(/^\(/)) {
				query.value.$lt = max.slice(1);
			} else if (max.match(/^\[/)) {
				query.value.$lte = max.slice(1);
			} else {
				query.value.$lte = max;
			}
		}
	}

	module.getSortedSetScan = async function (params) {
		const project = { _id: 0, value: 1 };
		if (params.withScores) {
			project.score = 1;
		}

		const match = helpers.buildMatchQuery(params.match);
		let regex;
		try {
			regex = new RegExp(match);
		} catch (err) {
			return [];
		}

		const cursor = module.client.collection('objects').find({
			_key: params.key, value: { $regex: regex },
		}, { projection: project });

		if (params.limit) {
			cursor.limit(params.limit);
		}

		const data = await cursor.toArray();
		if (!params.withScores) {
			return data.map(d => d.value);
		}
		return data;
	};

	module.processSortedSet = async function (setKey, processFn, options) {
		let done = false;
		const ids = [];
		const project = { _id: 0, _key: 0 };
		const sort = options.reverse ? -1 : 1;
		if (!options.withScores) {
			project.score = 0;
		}
		const query = { _key: setKey };
		if (options.min && options.min !== '-inf') {
			query.score = { $gte: parseFloat(options.min) };
		}
		if (options.max && options.max !== '+inf') {
			query.score = query.score || {};
			query.score.$lte = parseFloat(options.max);
		}

		const cursor = await module.client.collection('objects')
			.find(query, { projection: project })
			.sort({ score: sort })
			.batchSize(options.batch);

		if (processFn && processFn.constructor && processFn.constructor.name !== 'AsyncFunction') {
			processFn = util.promisify(processFn);
		}
		let iteration = 1;
		while (!done) {
			/* eslint-disable no-await-in-loop */
			const item = await cursor.next();
			if (item === null) {
				done = true;
			} else {
				ids.push(options.withScores ? item : item.value);
			}

			if (ids.length >= options.batch || (done && ids.length !== 0)) {
				if (iteration > 1 && options.interval) {
					await sleep(options.interval);
				}
				await processFn(ids);
				iteration += 1;
				ids.length = 0;
			}
		}
	};
};
