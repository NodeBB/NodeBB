'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

	const _ = require('lodash');

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

		// Convert single key to array for uniform handling
		const keys = Array.isArray(key) ? key : [key];
		if (!keys.length) {
			return [];
		}

		const { dialect } = module;
		const now = helpers.getCurrentTimestamp(dialect);
		const isReverse = method === 'zrevrange' || method === 'zrevrangebyscore';

		// Handle negative start/stop like postgres does
		if (start < 0 && start > stop) {
			return [];
		}

		// Build base query
		let query = module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select(['z.value', 'z.score'])
			.where('o._key', 'in', keys)
			.where('o.type', '=', 'zset')
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]));

		if (min !== '-inf') {
			query = query.where('z.score', '>=', parseFloat(min));
		}
		if (max !== '+inf') {
			query = query.where('z.score', '<=', parseFloat(max));
		}

		if (isReverse) {
			query = query.orderBy('z.score', 'desc');
		} else {
			query = query.orderBy('z.score', 'asc');
		}

		// If any index is negative, we need to fetch all and then slice
		if (start < 0 || stop < 0) {
			const allResults = await query.execute();
			const len = allResults.length;

			// Convert negative indices to positive
			const startIdx = start < 0 ? Math.max(0, len + start) : start;
			const stopIdx = stop < 0 ? len + stop : stop;

			// Handle invalid ranges
			if (startIdx > stopIdx) {
				return [];
			}

			// Slice the results (stopIdx is inclusive, so +1)
			const sliced = allResults.slice(startIdx, stopIdx + 1);

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
		// If count is 0, return empty array
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
		const now = helpers.getCurrentTimestamp(dialect);
		const isReverse = method === 'zrevrangebyscore';

		let query = module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select(withScores ? ['z.value', 'z.score'] : ['z.value'])
			.where('o._key', '=', key)
			.where('o.type', '=', 'zset')
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]));

		if (min !== '-inf') {
			query = query.where('z.score', '>=', parseFloat(min));
		}
		if (max !== '+inf') {
			query = query.where('z.score', '<=', parseFloat(max));
		}

		if (isReverse) {
			query = query.orderBy('z.score', 'desc');
		} else {
			query = query.orderBy('z.score', 'asc');
		}

		// Apply offset and limit
		// Note: SQLite requires LIMIT when using OFFSET
		if (start > 0 && count > 0) {
			query = query.offset(start).limit(count);
		} else if (start > 0) {
			// Use a large limit when only offset is needed (SQLite requirement)
			query = query.offset(start).limit(Number.MAX_SAFE_INTEGER);
		} else if (count > 0) {
			query = query.limit(count);
		}

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

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);

		let query = module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select(eb => eb.fn.count('z.value').as('count'))
			.where('o._key', '=', key)
			.where('o.type', '=', 'zset')
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]));

		if (min !== '-inf') {
			query = query.where('z.score', '>=', parseFloat(min));
		}
		if (max !== '+inf') {
			query = query.where('z.score', '<=', parseFloat(max));
		}

		const result = await query.executeTakeFirst();
		return result ? parseInt(result.count, 10) : 0;
	};

	module.sortedSetCard = async function (key) {
		if (!key) {
			return 0;
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select(eb => eb.fn.count('z.value').as('count'))
			.where('o._key', '=', key)
			.where('o.type', '=', 'zset')
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.executeTakeFirst();

		return result ? parseInt(result.count, 10) : 0;
	};

	module.sortedSetsCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select(['o._key'])
			.select(eb => eb.fn.count('z.value').as('count'))
			.where('o._key', 'in', keys)
			.where('o.type', '=', 'zset')
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.groupBy('o._key')
			.execute();

		const map = {};
		result.forEach((r) => {
			map[r._key] = parseInt(r.count, 10);
		});

		return keys.map(k => (map.hasOwnProperty(k) ? map[k] : 0));
	};

	module.sortedSetsCardSum = async function (keys, min = '-inf', max = '+inf') {
		if (!keys || (Array.isArray(keys) && !keys.length)) {
			return 0;
		}
		if (!Array.isArray(keys)) {
			keys = [keys];
		}

		let counts = [];
		if (min !== '-inf' || max !== '+inf') {
			const {dialect} = module;
			const now = helpers.getCurrentTimestamp(dialect);

			const minVal = min === '-inf' ? null : parseFloat(min);
			const maxVal = max === '+inf' ? null : parseFloat(max);

			let query = module.db.selectFrom('legacy_object as o')
				.innerJoin('legacy_zset as z', 'z._key', 'o._key')
				.select(['o._key'])
				.select(eb => eb.fn.count('z.value').as('count'))
				.where('o._key', 'in', keys)
				.where('o.type', '=', 'zset')
				.where(eb => eb.or([
					eb('o.expireAt', 'is', null),
					eb('o.expireAt', '>', now),
				]));

			if (minVal !== null) {
				query = query.where('z.score', '>=', minVal);
			}
			if (maxVal !== null) {
				query = query.where('z.score', '<=', maxVal);
			}

			const result = await query.groupBy('o._key').execute();

			const map = {};
			result.forEach((r) => {
				map[r._key] = parseInt(r.count, 10);
			});

			counts = keys.map(k => (map.hasOwnProperty(k) ? map[k] : 0));
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
		const now = helpers.getCurrentTimestamp(dialect);
		const isReverse = method === 'zrevrank';
		value = helpers.valueToString(value);

		// First check if the member exists
		const exists = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select('z.score')
			.where('o._key', '=', key)
			.where('o.type', '=', 'zset')
			.where('z.value', '=', value)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.executeTakeFirst();

		if (!exists) {
			return null;
		}

		// Count members with lower (or higher for rev) score
		// When scores are equal, sort by value alphabetically
		const countQuery = module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select(eb => eb.fn.count('z.value').as('count'))
			.where('o._key', '=', key)
			.where('o.type', '=', 'zset')
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.where((eb) => {
				if (isReverse) {
					// For reverse: count elements with higher score OR same score with higher value
					return eb.or([
						eb('z.score', '>', exists.score),
						eb.and([
							eb('z.score', '=', exists.score),
							eb('z.value', '>', value),
						]),
					]);
				}
				// For normal: count elements with lower score OR same score with lower value
				return eb.or([
					eb('z.score', '<', exists.score),
					eb.and([
						eb('z.score', '=', exists.score),
						eb('z.value', '<', value),
					]),
				]);
			});

		const result = await countQuery.executeTakeFirst();
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

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);
		value = helpers.valueToString(value);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select('z.score')
			.where('o._key', '=', key)
			.where('o.type', '=', 'zset')
			.where('z.value', '=', value)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.executeTakeFirst();

		return result ? parseFloat(result.score) : null;
	};

	module.sortedSetsScore = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);
		value = helpers.valueToString(value);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select(['o._key', 'z.score'])
			.where('o._key', 'in', keys)
			.where('o.type', '=', 'zset')
			.where('z.value', '=', value)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.execute();

		const map = {};
		result.forEach((r) => {
			map[r._key] = parseFloat(r.score);
		});

		return keys.map(k => (map.hasOwnProperty(k) ? map[k] : null));
	};

	module.sortedSetScores = async function (key, values) {
		if (!key) {
			return [];
		}
		if (!Array.isArray(values) || !values.length) {
			return [];
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);
		values = values.map(v => helpers.valueToString(v));

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select(['z.value', 'z.score'])
			.where('o._key', '=', key)
			.where('o.type', '=', 'zset')
			.where('z.value', 'in', values)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.execute();

		const map = {};
		result.forEach((r) => {
			map[r.value] = parseFloat(r.score);
		});

		return values.map(v => (map.hasOwnProperty(v) ? map[v] : null));
	};

	module.isSortedSetMember = async function (key, value) {
		if (!key) {
			return false;
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);
		value = helpers.valueToString(value);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select('z.value')
			.where('o._key', '=', key)
			.where('o.type', '=', 'zset')
			.where('z.value', '=', value)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
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

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);
		values = values.map(v => helpers.valueToString(v));

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select('z.value')
			.where('o._key', '=', key)
			.where('o.type', '=', 'zset')
			.where('z.value', 'in', values)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.execute();

		const memberSet = new Set(result.map(r => r.value));
		return values.map(v => memberSet.has(v));
	};

	module.isMemberOfSortedSets = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);
		value = helpers.valueToString(value);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select('o._key')
			.where('o._key', 'in', keys)
			.where('o.type', '=', 'zset')
			.where('z.value', '=', value)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
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

		const { dialect } = module;
		const now = helpers.getCurrentTimestamp(dialect);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select(['o._key', 'z.value'])
			.where('o._key', 'in', keys)
			.where('o.type', '=', 'zset')
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.orderBy('z.score', 'asc')
			.execute();

		const map = {};
		keys.forEach((k) => { map[k] = []; });
		result.forEach((r) => {
			map[r._key].push(r.value);
		});

		return keys.map(k => map[k]);
	};

	module.getSortedSetsMembersWithScores = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const { dialect } = module;
		const now = helpers.getCurrentTimestamp(dialect);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select(['o._key', 'z.value', 'z.score'])
			.where('o._key', 'in', keys)
			.where('o.type', '=', 'zset')
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.orderBy('z.score', 'asc')
			.execute();

		const map = {};
		keys.forEach((k) => { map[k] = []; });
		result.forEach((r) => {
			map[r._key].push({ value: r.value, score: parseFloat(r.score) });
		});

		return keys.map(k => map[k]);
	};

	module.sortedSetIncrBy = async function (key, increment, value) {
		if (!key) {
			return;
		}

		const {dialect} = module;
		value = helpers.valueToString(value);

		return await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectType(client, key, 'zset', dialect);
			
			// Get current score
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

		const {dialect} = module;

		return await module.transaction(async (client) => {
			const results = [];
			for (const item of data) {
				const [key, increment, value] = item;
				const strValue = helpers.valueToString(value);
				
				await helpers.ensureLegacyObjectType(client, key, 'zset', dialect);
				
				// Get current score
				const existing = await client.selectFrom('legacy_zset')
					.select('score')
					.where('_key', '=', key)
					.where('value', '=', strValue)
					.executeTakeFirst();

				const currentScore = existing ? parseFloat(existing.score) : 0;
				const newScore = currentScore + parseFloat(increment);

				await helpers.upsert(client, 'legacy_zset', {
					_key: key,
					value: strValue,
					score: newScore,
				}, ['_key', 'value'], { score: newScore }, dialect);

				results.push(newScore);
			}
			return results;
		});
	};

	// Helper function to parse lex range notation
	// - '-' means minimum (from beginning)
	// - '+' means maximum (to end)
	// - '[a' means >= 'a' (inclusive)
	// - '(a' means > 'a' (exclusive)
	// - 'a' (no prefix) defaults to inclusive
	function parseLexRange(value) {
		if (value === '-') {
			return { value: null, op: null, isMin: true };
		}
		if (value === '+') {
			return { value: null, op: null, isMax: true };
		}
		if (value.startsWith('(')) {
			return { value: value.slice(1), inclusive: false };
		}
		if (value.startsWith('[')) {
			return { value: value.slice(1), inclusive: true };
		}
		// Default to inclusive
		return { value: value, inclusive: true };
	}

	function applyLexConditions(query, min, max) {
		const minParsed = parseLexRange(min);
		const maxParsed = parseLexRange(max);

		if (!minParsed.isMin) {
			const op = minParsed.inclusive ? '>=' : '>';
			query = query.where('z.value', op, minParsed.value);
		}
		if (!maxParsed.isMax) {
			const op = maxParsed.inclusive ? '<=' : '<';
			query = query.where('z.value', op, maxParsed.value);
		}
		return query;
	}

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

		const { dialect } = module;
		const now = helpers.getCurrentTimestamp(dialect);

		let query = module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select(eb => eb.fn.count('z.value').as('count'))
			.where('o._key', '=', key)
			.where('o.type', '=', 'zset')
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]));

		query = applyLexConditions(query, min, max);

		const result = await query.executeTakeFirst();
		return result ? parseInt(result.count, 10) : 0;
	};

	async function sortedSetLex(key, min, max, sort, start, count) {
		if (!key) {
			return [];
		}

		const { dialect } = module;
		const now = helpers.getCurrentTimestamp(dialect);

		let query = module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select('z.value')
			.where('o._key', '=', key)
			.where('o.type', '=', 'zset')
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]));

		query = applyLexConditions(query, min, max);

		if (sort === 1) {
			query = query.orderBy('z.value', 'asc');
		} else {
			query = query.orderBy('z.value', 'desc');
		}

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

		const { dialect } = module;
		const now = helpers.getCurrentTimestamp(dialect);

		// Get values to delete
		let selectQuery = module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select('z.value')
			.where('o._key', '=', key)
			.where('o.type', '=', 'zset')
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]));

		selectQuery = applyLexConditions(selectQuery, min, max);

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

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);
		const pattern = helpers.buildLikePattern(match);

		let query = module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_zset as z', 'z._key', 'o._key')
			.select(['z.value', 'z.score'])
			.where('o._key', '=', key)
			.where('o.type', '=', 'zset')
			.where('z.value', 'like', pattern)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.orderBy('z.score', 'asc');

		if (limit) {
			query = query.limit(limit);
		}

		const result = await query.execute();
		if (!withScores) {
			return result.map(r => r.value);
		}
		return result.map(r => ({ value: r.value, score: parseFloat(r.score) }));
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