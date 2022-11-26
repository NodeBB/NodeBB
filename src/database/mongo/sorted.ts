'use strict';

const _ = require('lodash');
const utils = require('../../utils');
import helpers from './helpers';


export default  function (module) {
	const dbHelpers = require('../helpers').default;

	const util = require('util');
	const sleep = util.promisify(setTimeout);

	require('./sorted/add').default(module);
	require('./sorted/remove').default(module);
	require('./sorted/union').default(module);
	require('./sorted/intersect').default(module);

	module.getSortedSetRange = async function (key: string, start: number, stop: number) {
		return await getSortedSetRange(key, start, stop, '-inf', '+inf', 1, false);
	};

	module.getSortedSetRevRange = async function (key: string, start: number, stop: number) {
		return await getSortedSetRange(key, start, stop, '-inf', '+inf', -1, false);
	};

	module.getSortedSetRangeWithScores = async function (key: string, start: number, stop: number) {
		return await getSortedSetRange(key, start, stop, '-inf', '+inf', 1, true);
	};

	module.getSortedSetRevRangeWithScores = async function (key: string, start: number, stop: number) {
		return await getSortedSetRange(key, start, stop, '-inf', '+inf', -1, true);
	};

	async function getSortedSetRange(key: string, start: number, stop: number, min: number | string, max: number | string, sort: number, withScores: boolean) {
		if (!key) {
			return;
		}
		const isArray = Array.isArray(key);
		if ((start < 0 && start > stop) || (isArray && !key.length)) {
			return [];
		}
		const query = { _key: key } as any;
		if (isArray) {
			if (key.length > 1) {
				query._key = { $in: key };
			} else {
				query._key = key[0];
			}
		}

		if (min !== '-inf') {
			query.score = { $gte: min };
		}
		if (max !== '+inf') {
			query.score = query.score || {};
			query.score.$lte = max;
		}

		if (max === min) {
			query.score = max;
		}

		const fields = { _id: 0, _key: 0 } as any;
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

		let result : any[] = [];
		async function doQuery(_key, fields, skip: number, limit: number) {
			console.log('MODULE', module);
			return await module.client.collection('objects').find({ ...query, ...{ _key: _key } }, { projection: fields })
				.sort({ score: sort })
				.skip(skip)
				.limit(limit)
				.toArray();
		}

		if (isArray && key.length > 100) {
			const batches : any[] = [];
			const batch = require('../../batch');
			const batchSize = Math.ceil(key.length / Math.ceil(key.length / 100));
			await batch.processArray(key, async (currentBatch) => batches.push(currentBatch), { batch: batchSize });
			const batchData = await Promise.all(batches.map(
				(batch) => doQuery({ $in: batch }, { _id: 0, _key: 0 }, 0, stop + 1)
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
			result = result.map((item) => item.value);
		}

		return result;
	}

	module.getSortedSetRangeByScore = async function (key: string, start: number, count: number, min: number, max: number) {
		return await getSortedSetRangeByScore(key, start, count, min, max, 1, false);
	};

	module.getSortedSetRevRangeByScore = async function (key: string, start: number, count: number, max: number, min: number) {
		return await getSortedSetRangeByScore(key, start, count, min, max, -1, false);
	};

	module.getSortedSetRangeByScoreWithScores = async function (key: string, start: number, count: number, min: number, max: number) {
		return await getSortedSetRangeByScore(key, start, count, min, max, 1, true);
	};

	module.getSortedSetRevRangeByScoreWithScores = async function (key: string, start: number, count: number, max: number, min: number) {
		return await getSortedSetRangeByScore(key, start, count, min, max, -1, true);
	};

	async function getSortedSetRangeByScore(key: string, start: number, count: number | string, min: number, max: number, sort: number, withScores: boolean) {
		if (parseInt(count as string, 10) === 0) {
			return [];
		}
		const stop = (parseInt(count as string, 10) === -1) ? -1 : (start + (count as number)  - 1);
		return await getSortedSetRange(key, start, stop, min, max, sort, withScores);
	}

	module.sortedSetCount = async function (key: string, min: number | string, max: number | string) {
		if (!key) {
			return;
		}

		const query = { _key: key } as any;
		if (min !== '-inf') {
			query.score = { $gte: min };
		}
		if (max !== '+inf') {
			query.score = query.score || {};
			query.score.$lte = max;
		}
		console.log('MODULE', module);
		const count = await module.client.collection('objects').countDocuments(query);
		return count || 0;
	};

	module.sortedSetCard = async function (key: string) {
		if (!key) {
			return 0;
		}
		console.log('MODULE CLIENT', module.client);
		const count = await module.client.collection('objects').countDocuments({ _key: key });
	module.sortedSetsCard = async function (keys: string[]) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const promises = keys.map(k => module.sortedSetCard(k));
		return await Promise.all(promises);
	};

	module.sortedSetsCardSum = async function (keys: string[]) {
		if (!keys || (Array.isArray(keys) && !keys.length)) {
			return 0;
		}
		console.log('MODULE CLIENT', module.client);

		const count = await module.client.collection('objects').countDocuments({ _key: Array.isArray(keys) ? { $in: keys } : keys });
		return parseInt(count, 10) || 0;
	};

	module.sortedSetRank = async function (key: string, value: string) {
		return await getSortedSetRank(false, key, value);
	};

	module.sortedSetRevRank = async function (key: string, value: string) {
		return await getSortedSetRank(true, key, value);
	};

	async function getSortedSetRank(reverse: boolean, key: string, value: string) {
		if (!key) {
			return;
		}
		value = helpers.valueToString(value);
		const score = await module.sortedSetScore(key, value);
		if (score === null) {
			return null;
		}
		console.log('MODULE', module);

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

	module.sortedSetsRanks = async function (keys: string[], values: string[]) {
		return await sortedSetsRanks(module.sortedSetRank, keys, values);
	};

	module.sortedSetsRevRanks = async function (keys: string[], values: string[]) {
		return await sortedSetsRanks(module.sortedSetRevRank, keys, values);
	};

	async function sortedSetsRanks(method: Function, keys: string[], values: string[]) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const data = new Array(values.length);
		for (let i = 0; i < values.length; i += 1) {
			data[i] = { key: keys[i], value: values[i] };
		}
		const promises = data.map((item) => method(item.key, item.value));
		return await Promise.all(promises);
	}

	async function sortedSetRanks(reverse: boolean, key: string, values: string[]) {
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


	module.sortedSetRanks = async function (key: string, values: string[]) {
		return await sortedSetRanks(false, key, values);
	};

	module.sortedSetRevRanks = async function (key: string, values: string[]) {
		return await sortedSetRanks(true, key, values);
	};

	module.sortedSetScore = async function (key: string, value: string) {
		if (!key) {
			return null;
		}
		value = helpers.valueToString(value);
		console.log('MODULE', module);
		const result = await module.client.collection('objects').findOne({ _key: key, value: value }, { projection: { _id: 0, _key: 0, value: 0 } });
		return result ? result.score : null;
	};

	module.sortedSetsScore = async function (keys: string[], value: string) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		value = helpers.valueToString(value);
		console.log('MODULE', module);
		const result = await module.client.collection('objects').find({ _key: { $in: keys }, value: value }, { projection: { _id: 0, value: 0 } }).toArray();
		const map  = {} as any;
		result.forEach((item) => {
			if (item) {
				map[item._key] = item;
			}
		});

		return keys.map(key => (map[key] ? map[key].score : null));
	};

	module.sortedSetScores = async function (key: string, values: string[]) {
		if (!key) {
			return null;
		}
		if (!values.length) {
			return [];
		}
		values = values.map(helpers.valueToString);
		console.log('MODULE', module);
		const result = await module.client.collection('objects').find({ _key: key, value: { $in: values } }, { projection: { _id: 0, _key: 0 } }).toArray();

		const valueToScore  = {} as any;
		result.forEach((item) => {
			if (item) {
				valueToScore[item.value] = item.score;
			}
		});

		return values.map(v => (utils.isNumber(valueToScore[v]) ? valueToScore[v] : null));
	};

	module.isSortedSetMember = async function (key: string, value: string) {
		if (!key) {
			return;
		}
		value = helpers.valueToString(value);
		console.log('MODULE', module);
		const result = await module.client.collection('objects').findOne({
			_key: key, value: value,
		}, {
			projection: { _id: 0, value: 1 },
		});
		return !!result;
	};

	module.isSortedSetMembers = async function (key: string, values: string[]) {
		if (!key) {
			return;
		}
		if (!values.length) {
			return [];
		}
		values = values.map(helpers.valueToString);
		console.log('MODULE', module);
		const results = await module.client.collection('objects').find({
			_key: key, value: { $in: values },
		}, {
			projection: { _id: 0, value: 1 },
		}).toArray();

		const isMember  = {} as any;
		results.forEach((item) => {
			if (item) {
				isMember[item.value] = true;
			}
		});

		return values.map(value => !!isMember[value]);
	};

	module.isMemberOfSortedSets = async function (keys: string[], value: string) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		value = helpers.valueToString(value);
		console.log('MODULE', module);
		const results = await module.client.collection('objects').find({
			_key: { $in: keys }, value: value,
		}, {
			projection: { _id: 0, _key: 1, value: 1 },
		}).toArray();

		const isMember  = {} as any;
		results.forEach((item) => {
			if (item) {
				isMember[item._key] = true;
			}
		});

		return keys.map(key => !!isMember[key]);
	};

	module.getSortedSetMembers = async function (key: string) {
		const data = await module.getSortedSetsMembers([key]);
		return data && data[0];
	};

	module.getSortedSetsMembers = async function (keys: string[]) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const arrayOfKeys = keys.length > 1;
		const projection = { _id: 0, value: 1 } as any;
		if (arrayOfKeys) {
			projection._key = 1;
		}
		console.log('MODULE', module);
		const data = await module.client.collection('objects').find({
			_key: arrayOfKeys ? { $in: keys } : keys[0],
		}, { projection: projection }).toArray();

		if (!arrayOfKeys) {
			return [data.map((item) => item.value)];
		}
		const sets  = {} as any;
		data.forEach((item) => {
			sets[item._key] = sets[item._key] || [];
			sets[item._key].push(item.value);
		});

		return keys.map(k => sets[k] || []);
	};

	module.sortedSetIncrBy = async function (key: string, increment: string, value: string) {
		if (!key) {
			return;
		}
		const data  = {} as any;
		value = helpers.valueToString(value);
		data.score = parseFloat(increment);
		try {
			console.log('MODULE', module);
			const result = await module.client.collection('objects').findOneAndUpdate({
				_key: key,
				value: value,
			}, {
				$inc: data,
			}, {
				returnDocument: 'after',
				upsert: true,
			});
			return result && result.value ? result.value.score : null;
		} catch (err: any) {
			// if there is duplicate key error retry the upsert
			// https://github.com/NodeBB/NodeBB/issues/4467
			// https://jira.mongodb.org/browse/SERVER-14322
			// https://docs.mongodb.org/manual/reference/command/findAndModify/#upsert-and-unique-index
			if (err && err.message.startsWith('E11000 duplicate key error')) {
				return await module.sortedSetIncrBy(key, increment, value);
			}
			throw err;
		}
	};

	module.sortedSetIncrByBulk = async function (data) {
		console.log('MODULE', module);
		const bulk = module.client.collection('objects').initializeUnorderedBulkOp();
		data.forEach((item) => {
			bulk.find({ _key: item[0], value: helpers.valueToString(item[2]) })
				.upsert()
				.update({ $inc: { score: parseFloat(item[1]) } });
		});
		await bulk.execute();
		console.log('MODULE', module);
		const result = await module.client.collection('objects').find({
			_key: { $in: _.uniq(data.map((i) => i[0])) },
			value: { $in: _.uniq(data.map((i) => i[2])) },
		}, {
			projection: { _id: 0, _key: 1, value: 1, score: 1 },
		}).toArray();

		const map  = {} as any;
		result.forEach((item) => {
			map[`${item._key}:${item.value}`] = item.score;
		});
		return data.map((item) => map[`${item[0]}:${item[2]}`]);
	};

	module.getSortedSetRangeByLex = async function (key: string, min: number, max: number, start: number, count: number) {
		return await sortedSetLex(key, min, max, 1, start, count);
	};

	module.getSortedSetRevRangeByLex = async function (key: string, max: number, min: number, start: number, count: number) {
		return await sortedSetLex(key, min, max, -1, start, count);
	};

	module.sortedSetLexCount = async function (key: string, min: number, max: number) {
		const data = await sortedSetLex(key, min, max, 1, 0, 0);
		return data ? data.length : null;
	};

	async function sortedSetLex(key: string, min: number, max: number, sort: number, start: number, count: number) {
		const query = { _key: key };
		start = start !== undefined ? start : 0;
		count = count !== undefined ? count : 0;
		buildLexQuery(query, min, max);
		console.log('MODULE', module);
		const data = await module.client.collection('objects').find(query, { projection: { _id: 0, value: 1 } })
			.sort({ value: sort })
			.skip(start)
			.limit(count === -1 ? 0 : count)
			.toArray();

		return data.map((item) => item && item.value);
	}

	module.sortedSetRemoveRangeByLex = async function (key: string, min: number, max: number) {
		const query = { _key: key };
		buildLexQuery(query, min, max);
		console.log('MODULE', module);
		await module.client.collection('objects').deleteMany(query);
	};

	function buildLexQuery(query, min: string | number, max: string | number) {
		if (min !== '-') {
			if ((min as string).match(/^\(/)) {
				query.value = { $gt: (min as string).slice(1) };
			} else if ((min as string).match(/^\[/)) {
				query.value = { $gte: (min as string).slice(1) };
			} else {
				query.value = { $gte: min };
			}
		}
		if (max !== '+') {
			query.value = query.value || {};
			if ((max as any).match(/^\(/)) {
				query.value.$lt = (max as any).slice(1);
			} else if ((max as any).match(/^\[/)) {
				query.value.$lte = (max as any).slice(1);
			} else {
				query.value.$lte = max;
			}
		}
	}

	module.getSortedSetScan = async function (params) {
		const project = { _id: 0, value: 1 } as any;
		if (params.withScores) {
			project.score = 1;
		}

		const match = helpers.buildMatchQuery(params.match);
		let regex;
		try {
			regex = new RegExp(match);
		} catch (err: any) {
			return [];
		}
		console.log('MODULE', module);
		const cursor = module.client.collection('objects').find({
			_key: params.key, value: { $regex: regex },
		}, { projection: project });

		if (params.limit) {
			cursor.limit(params.limit);
		}

		const data = await cursor.toArray();
		if (!params.withScores) {
			return data.map((d) => d.value);
		}
		return data;
	};

	module.processSortedSet = async function (setKey: string, processFn: Function, options) {
		let done = false;
		const ids : any[] = [];
		const project = { _id: 0, _key: 0 } as any;

		if (!options.withScores) {
			project.score = 0;
		}
		console.log('MODULE', module);

		const cursor = await module.client.collection('objects').find({ _key: setKey }, { projection: project })
			.sort({ score: 1 })
			.batchSize(options.batch);

		if (processFn && processFn.constructor && processFn.constructor.name !== 'AsyncFunction') {
			processFn = util.promisify(processFn);
		}

		while (!done) {
			/* eslint-disable no-await-in-loop */
			const item = await cursor.next();
			if (item === null) {
				done = true;
			} else {
				ids.push(options.withScores ? item : item.value);
			}

			if (ids.length >= options.batch || (done && ids.length !== 0)) {
				await processFn(ids);

				ids.length = 0;
				if (options.interval) {
					await sleep(options.interval);
				}
			}
		}
	};
};
