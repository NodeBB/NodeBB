'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

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
		if (!key) {
			return;
		}

		const keys = Array.isArray(key) ? key : [key];
		if (!keys.length) {
			return [];
		}

		const { dialect } = module;
		const isReverse = method === 'zrevrange' || method === 'zrevrangebyscore';

		if (start < 0 && start > stop) {
			return [];
		}

		let query = helpers.createZsetQuery(module.db, dialect)
			.select(['z.value', 'z.score'])
			.where('o._key', 'in', keys);

		query = helpers.applyScoreConditions(query, min, max);
		query = query.orderBy('z.score', isReverse ? 'desc' : 'asc');

		// Handle negative indices
		if (start < 0 || stop < 0) {
			const allResults = await query.execute();
			const sliced = helpers.sliceWithNegativeIndices(allResults, start, stop);
			if (withScores) {
				return sliced.map(r => ({ value: r.value, score: parseFloat(r.score) }));
			}
			return sliced.map(r => r.value);
		}

		// Positive indices - use offset/limit
		const limit = stop - start + 1;
		if (limit > 0) {
			query = query.offset(start).limit(limit);
		}

		const result = await query.execute();
		if (withScores) {
			return result.map(r => ({ value: r.value, score: parseFloat(r.score) }));
		}
		return result.map(r => r.value);
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
		if (count === 0) {
			return [];
		}

		if (Array.isArray(key)) {
			if (!key.length) {
				return [];
			}
			return module.sortedSetUnion({ method, sets: key, start, stop: start + count - 1, min, max, withScores });
		}

		const { dialect } = module;
		const isReverse = method === 'zrevrangebyscore';

		let query = helpers.createZsetQuery(module.db, dialect)
			.select(withScores ? ['z.value', 'z.score'] : ['z.value'])
			.where('o._key', '=', key);

		query = helpers.applyScoreConditions(query, min, max);
		query = query.orderBy('z.score', isReverse ? 'desc' : 'asc');
		query = helpers.applyPagination(query, start, count);

		const result = await query.execute();
		if (withScores) {
			return result.map(r => ({ value: r.value, score: parseFloat(r.score) }));
		}
		return result.map(r => r.value);
	}

	module.sortedSetCount = async function (key, min, max) {
		if (!key) {
			return 0;
		}

		let query = helpers.createZsetQuery(module.db, module.dialect)
			.select(eb => eb.fn.count('z.value').as('count'))
			.where('o._key', '=', key);

		query = helpers.applyScoreConditions(query, min, max);

		const result = await query.executeTakeFirst();
		return result ? parseInt(result.count, 10) : 0;
	};

	module.sortedSetCard = async function (key) {
		if (!key) {
			return 0;
		}

		const result = await helpers.createZsetQuery(module.db, module.dialect)
			.select(eb => eb.fn.count('z.value').as('count'))
			.where('o._key', '=', key)
			.executeTakeFirst();

		return result ? parseInt(result.count, 10) : 0;
	};

	module.sortedSetsCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const result = await helpers.createZsetQuery(module.db, module.dialect)
			.select(['o._key'])
			.select(eb => eb.fn.count('z.value').as('count'))
			.where('o._key', 'in', keys)
			.groupBy('o._key')
			.execute();

		return helpers.mapCountsToKeys(keys, result, '_key', 'count');
	};

	module.sortedSetsCardSum = async function (keys, min = '-inf', max = '+inf') {
		if (!keys || (Array.isArray(keys) && !keys.length)) {
			return 0;
		}
		if (!Array.isArray(keys)) {
			keys = [keys];
		}

		let counts;
		if (min !== '-inf' || max !== '+inf') {
			let query = helpers.createZsetQuery(module.db, module.dialect)
				.select(['o._key'])
				.select(eb => eb.fn.count('z.value').as('count'))
				.where('o._key', 'in', keys);

			query = helpers.applyScoreConditions(query, min, max);
			const result = await query.groupBy('o._key').execute();
			counts = helpers.mapCountsToKeys(keys, result, '_key', 'count');
		} else {
			counts = await module.sortedSetsCard(keys);
		}
		return counts.reduce((acc, val) => acc + val, 0);
	};

	module.sortedSetRank = async function (key, value) {
		return await getSortedSetRank('zrank', key, value);
	};

	module.sortedSetRevRank = async function (key, value) {
		return await getSortedSetRank('zrevrank', key, value);
	};

	async function getSortedSetRank(method, key, value) {
		if (!key) {
			return null;
		}

		const { dialect } = module;
		const isReverse = method === 'zrevrank';
		value = helpers.valueToString(value);

		// First check if the member exists
		const exists = await helpers.createZsetQuery(module.db, dialect)
			.select('z.score')
			.where('o._key', '=', key)
			.where('z.value', '=', value)
			.executeTakeFirst();

		if (!exists) {
			return null;
		}

		// Count members with lower (or higher for rev) score
		// When scores are equal, sort by value alphabetically
		const result = await helpers.createZsetQuery(module.db, dialect)
			.select(eb => eb.fn.count('z.value').as('count'))
			.where('o._key', '=', key)
			.where((eb) => {
				if (isReverse) {
					return eb.or([
						eb('z.score', '>', exists.score),
						eb.and([
							eb('z.score', '=', exists.score),
							eb('z.value', '>', value),
						]),
					]);
				}
				return eb.or([
					eb('z.score', '<', exists.score),
					eb.and([
						eb('z.score', '=', exists.score),
						eb('z.value', '<', value),
					]),
				]);
			})
			.executeTakeFirst();

		return result ? parseInt(result.count, 10) : 0;
	}

	module.sortedSetsRanks = async function (keys, values) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		return await Promise.all(keys.map((key, i) => module.sortedSetRank(key, values[i])));
	};

	module.sortedSetsRevRanks = async function (keys, values) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		return await Promise.all(keys.map((key, i) => module.sortedSetRevRank(key, values[i])));
	};

	module.sortedSetRanks = async function (key, values) {
		if (!Array.isArray(values) || !values.length) {
			return [];
		}
		return await Promise.all(values.map(value => module.sortedSetRank(key, value)));
	};

	module.sortedSetRevRanks = async function (key, values) {
		if (!Array.isArray(values) || !values.length) {
			return [];
		}
		return await Promise.all(values.map(value => module.sortedSetRevRank(key, value)));
	};

	module.sortedSetScore = async function (key, value) {
		if (!key) {
			return null;
		}

		value = helpers.valueToString(value);

		const result = await helpers.createZsetQuery(module.db, module.dialect)
			.select('z.score')
			.where('o._key', '=', key)
			.where('z.value', '=', value)
			.executeTakeFirst();

		return result ? parseFloat(result.score) : null;
	};

	module.sortedSetsScore = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		value = helpers.valueToString(value);

		const result = await helpers.createZsetQuery(module.db, module.dialect)
			.select(['o._key', 'z.score'])
			.where('o._key', 'in', keys)
			.where('z.value', '=', value)
			.execute();

		return helpers.mapResultsToKeys(keys, result, '_key', 'score', null)
			.map(s => (s !== null ? parseFloat(s) : null));
	};

	module.sortedSetScores = async function (key, values) {
		if (!key) {
			return [];
		}
		if (!Array.isArray(values) || !values.length) {
			return [];
		}

		values = values.map(v => helpers.valueToString(v));

		const result = await helpers.createZsetQuery(module.db, module.dialect)
			.select(['z.value', 'z.score'])
			.where('o._key', '=', key)
			.where('z.value', 'in', values)
			.execute();

		return helpers.mapResultsToKeys(values, result, 'value', 'score', null)
			.map(s => (s !== null ? parseFloat(s) : null));
	};

	module.isSortedSetMember = async function (key, value) {
		if (!key) {
			return false;
		}

		value = helpers.valueToString(value);

		const result = await helpers.createZsetQuery(module.db, module.dialect)
			.select('z.value')
			.where('o._key', '=', key)
			.where('z.value', '=', value)
			.limit(1)
			.executeTakeFirst();

		return !!result;
	};

	module.isSortedSetMembers = async function (key, values) {
		if (!key) {
			return values.map(() => false);
		}
		if (!Array.isArray(values) || !values.length) {
			return [];
		}

		values = values.map(v => helpers.valueToString(v));

		const result = await helpers.createZsetQuery(module.db, module.dialect)
			.select('z.value')
			.where('o._key', '=', key)
			.where('z.value', 'in', values)
			.execute();

		const memberSet = new Set(result.map(r => r.value));
		return values.map(v => memberSet.has(v));
	};

	module.isMemberOfSortedSets = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		value = helpers.valueToString(value);

		const result = await helpers.createZsetQuery(module.db, module.dialect)
			.select('o._key')
			.where('o._key', 'in', keys)
			.where('z.value', '=', value)
			.execute();

		const memberSet = new Set(result.map(r => r._key));
		return keys.map(k => memberSet.has(k));
	};

	module.getSortedSetMembers = async function (key) {
		if (!key) {
			return [];
		}
		const result = await module.getSortedSetsMembers([key]);
		return result[0] || [];
	};

	module.getSortedSetMembersWithScores = async function (key) {
		if (!key) {
			return [];
		}
		const result = await module.getSortedSetsMembersWithScores([key]);
		return result[0] || [];
	};

	module.getSortedSetsMembers = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const result = await helpers.createZsetQuery(module.db, module.dialect)
			.select(['o._key', 'z.value'])
			.where('o._key', 'in', keys)
			.orderBy('z.score', 'asc')
			.execute();

		return helpers.mapResultsToKeysArray(keys, result, '_key', r => r.value);
	};

	module.getSortedSetsMembersWithScores = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const result = await helpers.createZsetQuery(module.db, module.dialect)
			.select(['o._key', 'z.value', 'z.score'])
			.where('o._key', 'in', keys)
			.orderBy('z.score', 'asc')
			.execute();

		return helpers.mapResultsToKeysArray(keys, result, '_key', r => ({
			value: r.value,
			score: parseFloat(r.score),
		}));
	};

	module.sortedSetIncrBy = async function (key, increment, value) {
		if (!key) {
			return;
		}

		value = helpers.valueToString(value);

		return await helpers.withTransaction(module, key, 'zset', async (client, dialect) => {
			const existing = await client.selectFrom('legacy_zset')
				.select('score')
				.where('_key', '=', key)
				.where('value', '=', value)
				.executeTakeFirst();

			const currentScore = existing ? parseFloat(existing.score) : 0;
			const newScore = currentScore + parseFloat(increment);

			await helpers.upsert(client, 'legacy_zset', {
				_key: key,
				value: value,
				score: newScore,
			}, ['_key', 'value'], { score: newScore }, dialect);

			return newScore;
		});
	};

	module.sortedSetIncrByBulk = async function (data) {
		if (!data || !Array.isArray(data) || !data.length) {
			return;
		}

		return await helpers.withTransaction(module, null, null, async (client, dialect) => {
			// Ensure all keys have the right type
			const uniqueKeys = [...new Set(data.map(item => item[0]))];
			await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'zset', dialect);

			// Build key-value pairs for querying existing scores
			const keyValuePairs = data.map(item => ({
				key: item[0],
				value: helpers.valueToString(item[2]),
			}));

			// Query all existing scores at once
			const existingScores = {};
			if (keyValuePairs.length) {
				const results = await client.selectFrom('legacy_zset')
					.select(['_key', 'value', 'score'])
					.where(eb => eb.or(
						keyValuePairs.map(p => eb.and([
							eb('_key', '=', p.key),
							eb('value', '=', p.value),
						]))
					))
					.execute();

				results.forEach((r) => {
					existingScores[`${r._key}:${r.value}`] = parseFloat(r.score);
				});
			}

			// Calculate new scores and build upsert rows
			const rows = [];
			const returnResults = [];
			for (const item of data) {
				const [key, increment, value] = item;
				const strValue = helpers.valueToString(value);
				const existKey = `${key}:${strValue}`;
				const currentScore = existingScores[existKey] || 0;
				const newScore = currentScore + parseFloat(increment);

				rows.push({
					_key: key,
					value: strValue,
					score: newScore,
				});
				returnResults.push(newScore);
			}

			// Batch upsert all rows
			if (rows.length) {
				await helpers.upsertMultiple(client, 'legacy_zset', rows, ['_key', 'value'], ['score'], dialect);
			}

			return returnResults;
		});
	};

	module.getSortedSetRangeByLex = async function (key, min, max, start, count) {
		return await sortedSetLex(key, min, max, 1, start, count);
	};

	module.getSortedSetRevRangeByLex = async function (key, max, min, start, count) {
		return await sortedSetLex(key, min, max, -1, start, count);
	};

	module.sortedSetLexCount = async function (key, min, max) {
		if (!key) {
			return 0;
		}

		let query = helpers.createZsetQuery(module.db, module.dialect)
			.select(eb => eb.fn.count('z.value').as('count'))
			.where('o._key', '=', key);

		query = helpers.applyLexConditions(query, min, max);

		const result = await query.executeTakeFirst();
		return result ? parseInt(result.count, 10) : 0;
	};

	async function sortedSetLex(key, min, max, sort, start, count) {
		if (!key) {
			return [];
		}

		let query = helpers.createZsetQuery(module.db, module.dialect)
			.select('z.value')
			.where('o._key', '=', key);

		query = helpers.applyLexConditions(query, min, max);
		query = query.orderBy('z.value', sort === 1 ? 'asc' : 'desc');

		if (start !== undefined && count !== undefined && count > 0) {
			query = query.offset(start).limit(count);
		}

		const result = await query.execute();
		return result.map(r => r.value);
	}

	module.sortedSetRemoveRangeByLex = async function (key, min, max) {
		if (!key) {
			return;
		}

		let selectQuery = helpers.createZsetQuery(module.db, module.dialect)
			.select('z.value')
			.where('o._key', '=', key);

		selectQuery = helpers.applyLexConditions(selectQuery, min, max);

		const toDelete = await selectQuery.execute();
		const values = toDelete.map(r => r.value);

		if (values.length) {
			await module.db.deleteFrom('legacy_zset')
				.where('_key', '=', key)
				.where('value', 'in', values)
				.execute();
		}
	};

	module.getSortedSetScan = async function (params) {
		const { key, match, limit, withScores } = params;

		if (!key) {
			return [];
		}

		const pattern = helpers.buildLikePattern(match);

		let query = helpers.createZsetQuery(module.db, module.dialect)
			.select(['z.value', 'z.score'])
			.where('o._key', '=', key)
			.where('z.value', 'like', pattern)
			.orderBy('z.score', 'asc');

		if (limit) {
			query = query.limit(limit);
		}

		const result = await query.execute();
		if (withScores) {
			return result.map(r => ({ value: r.value, score: parseFloat(r.score) }));
		}
		return result.map(r => r.value);
	};

	module.processSortedSet = async function (setKey, processFn, options) {
		const batch = options.batch || 100;
		let cursor = 0;
		let done = false;

		while (!done) {
			/* eslint-disable no-await-in-loop */
			const result = await module.getSortedSetRangeWithScores(setKey, cursor, cursor + batch - 1);
			if (!result.length) {
				done = true;
			} else {
				if (options.withScores) {
					await processFn(result);
				} else {
					await processFn(result.map(r => r.value));
				}
				cursor += batch;
				if (result.length < batch) {
					done = true;
				}
			}
		}
	};
};