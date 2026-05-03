'use strict';

const util = require('util');

module.exports = function (module) {
	const { helpers } = module;

	require('./sorted/add')(module);
	require('./sorted/remove')(module);
	require('./sorted/union')(module);
	require('./sorted/intersect')(module);

	// Unified zset range query. The four `getSortedSetRange*` and four
	// `getSortedSetRangeByScore*` exports differ only on three axes:
	//   - sort direction (asc / desc)
	//   - withScores (return strings or {value, score})
	//   - pagination: 'index' = start/stop with negative-index slice support,
	//                 'offset' = start/count where count=-1 means no limit
	// Score range parsing (`-inf`/`+inf`/NaN → no bound) is shared via
	// `helpers.applyScoreConditions`.
	async function zsetRange({ key, isReverse, withScores, mode, start, stop, count, min = '-inf', max = '+inf' }) {
		if (!key) return;
		const keys = Array.isArray(key) ? key : [key];
		if (!keys.length) return [];

		let query = helpers.createZsetQuery()
			.select(['z.value', 'z.score'])
			.where('o._key', 'in', keys);
		query = helpers.applyScoreConditions(query, min, max);
		query = query.orderBy('z.score', isReverse ? 'desc' : 'asc');

		const decode = rows => (withScores ?
			rows.map(r => ({ value: r.value, score: parseFloat(r.score) })) :
			rows.map(r => r.value));

		if (mode === 'index') {
			if (start < 0 && start > stop) return [];
			if (start < 0 || stop < 0) {
				return decode(helpers.sliceWithNegativeIndices(await query.execute(), start, stop));
			}
			const limit = stop - start + 1;
			if (limit > 0) query = helpers.applyPagination(query, start, limit);
		} else { // 'offset': count === -1 means "no limit"; applyPagination
			// treats count <= 0 as "no limit" too (using MAX_SAFE_INTEGER for
			// SQLite, which requires LIMIT when paired with OFFSET).
			if (count === 0) return [];
			query = helpers.applyPagination(query, start, parseInt(count, 10) === -1 ? 0 : count);
		}
		return decode(await query.execute());
	}

	module.getSortedSetRange = async function (key, start, stop) {
		return await zsetRange({ key, isReverse: false, withScores: false, mode: 'index', start, stop });
	};
	module.getSortedSetRevRange = async function (key, start, stop) {
		return await zsetRange({ key, isReverse: true, withScores: false, mode: 'index', start, stop });
	};
	module.getSortedSetRangeWithScores = async function (key, start, stop) {
		return await zsetRange({ key, isReverse: false, withScores: true, mode: 'index', start, stop });
	};
	module.getSortedSetRevRangeWithScores = async function (key, start, stop) {
		return await zsetRange({ key, isReverse: true, withScores: true, mode: 'index', start, stop });
	};

	module.getSortedSetRangeByScore = async function (key, start, count, min, max) {
		return await zsetRange({ key, isReverse: false, withScores: false, mode: 'offset', start, count, min, max });
	};
	module.getSortedSetRevRangeByScore = async function (key, start, count, max, min) {
		return await zsetRange({ key, isReverse: true, withScores: false, mode: 'offset', start, count, min, max });
	};
	module.getSortedSetRangeByScoreWithScores = async function (key, start, count, min, max) {
		return await zsetRange({ key, isReverse: false, withScores: true, mode: 'offset', start, count, min, max });
	};
	module.getSortedSetRevRangeByScoreWithScores = async function (key, start, count, max, min) {
		return await zsetRange({ key, isReverse: true, withScores: true, mode: 'offset', start, count, min, max });
	};

	module.sortedSetCount = async function (key, min, max) {
		if (!key) {
			return 0;
		}

		let query = helpers.createZsetQuery()
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

		const result = await helpers.createZsetQuery()
			.select(eb => eb.fn.count('z.value').as('count'))
			.where('o._key', '=', key)
			.executeTakeFirst();

		return result ? parseInt(result.count, 10) : 0;
	};

	module.sortedSetsCard = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const result = await helpers.createZsetQuery()
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
			let query = helpers.createZsetQuery()
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

		const isReverse = method === 'zrevrank';
		value = String(value);

		// First check if the member exists
		const exists = await helpers.createZsetQuery()
			.select('z.score')
			.where('o._key', '=', key)
			.where('z.value', '=', value)
			.executeTakeFirst();

		if (!exists) {
			return null;
		}

		// Count members with lower (or higher for rev) score
		// When scores are equal, sort by value alphabetically
		const result = await helpers.createZsetQuery()
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

	// Bulk rank lookup. The four exports differ only on (a) where the keys
	// come from (per-value vs single-key replicated) and (b) the rank
	// direction. Shared body is one helper.computeRanks call.
	const ranksFor = (lookup, isReverse) => helpers.computeRanks(module.db, lookup, isReverse);
	const lookupParallel = (keys, values) =>
		keys.map((key, i) => ({ _key: key, value: String(values[i]) }));
	const lookupReplicated = (key, values) =>
		values.map(v => ({ _key: key, value: String(v) }));

	module.sortedSetsRanks = async function (keys, values) {
		return Array.isArray(keys) && keys.length ? await ranksFor(lookupParallel(keys, values), false) : [];
	};
	module.sortedSetsRevRanks = async function (keys, values) {
		return Array.isArray(keys) && keys.length ? await ranksFor(lookupParallel(keys, values), true) : [];
	};
	module.sortedSetRanks = async function (key, values) {
		return Array.isArray(values) && values.length ? await ranksFor(lookupReplicated(key, values), false) : [];
	};
	module.sortedSetRevRanks = async function (key, values) {
		return Array.isArray(values) && values.length ? await ranksFor(lookupReplicated(key, values), true) : [];
	};

	module.sortedSetScore = async function (key, value) {
		if (!key) {
			return null;
		}

		value = String(value);

		const result = await helpers.createZsetQuery()
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

		value = String(value);

		const result = await helpers.createZsetQuery()
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

		values = values.map(v => String(v));

		const result = await helpers.createZsetQuery()
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

		value = String(value);

		const result = await helpers.createZsetQuery()
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
		const lookup = values.map(v => ({ _key: key, value: String(v) }));
		const rows = await helpers.fetchOrderedRows(
			module.db, 'legacy_zset', lookup, ['_key', 'value'], ['value'],
			{ notExpired: true },
		);
		return rows.map(r => r.value != null);
	};

	module.isMemberOfSortedSets = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		const v = String(value);
		const lookup = keys.map(k => ({ _key: k, value: v }));
		const rows = await helpers.fetchOrderedRows(
			module.db, 'legacy_zset', lookup, ['_key', 'value'], ['value'],
			{ notExpired: true },
		);
		return rows.map(r => r.value != null);
	};

	// Bulk members. The four exports collapse to "fetch (_key, value [, score])
	// per key, group, decode" with two axes: bulk-vs-singular and withScores.
	async function sortedSetsMembers(keys, withScores) {
		if (!Array.isArray(keys) || !keys.length) return [];
		const cols = withScores ? ['o._key', 'z.value', 'z.score'] : ['o._key', 'z.value'];
		const result = await helpers.createZsetQuery()
			.select(cols)
			.where('o._key', 'in', keys)
			.orderBy('z.score', 'asc')
			.execute();
		const decode = withScores ?
			r => ({ value: r.value, score: parseFloat(r.score) }) :
			r => r.value;
		return helpers.mapResultsToKeysArray(keys, result, '_key', decode);
	}

	module.getSortedSetsMembers = async keys => await sortedSetsMembers(keys, false);
	module.getSortedSetsMembersWithScores = async keys => await sortedSetsMembers(keys, true);
	module.getSortedSetMembers = async function (key) {
		return key ? (await sortedSetsMembers([key], false))[0] || [] : [];
	};
	module.getSortedSetMembersWithScores = async function (key) {
		return key ? (await sortedSetsMembers([key], true))[0] || [] : [];
	};

	module.sortedSetIncrBy = async function (key, increment, value) {
		if (!key) {
			return;
		}

		value = String(value);

		return await helpers.withTransaction(key, 'zset', async (client) => {
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
			}, ['_key', 'value'], { score: newScore });

			return newScore;
		});
	};

	module.sortedSetIncrByBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return [];
		}

		return await helpers.withTransaction(null, null, async (client) => {
			const uniqueKeys = [...new Set(data.map(([key]) => key))];
			await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'zset');

			// Fold per-pair deltas — required because ON CONFLICT / ON
			// DUPLICATE KEY can only update the same row once per statement.
			// Nested Map keeps composite lookups O(1) without delimiters.
			const folded = new Map();
			for (const [key, increment, rawValue] of data) {
				const value = String(rawValue);
				let inner = folded.get(key);
				if (!inner) { inner = new Map(); folded.set(key, inner); }
				inner.set(value, (inner.get(value) || 0) + parseFloat(increment));
			}
			const rows = [];
			for (const [key, inner] of folded) {
				for (const [value, score] of inner) {
					rows.push({ _key: key, value, score });
				}
			}

			// DB-side atomic add: each row's score is incremented by the
			// folded delta inside the UPSERT — no SELECT-then-UPDATE race.
			await helpers.upsertAddMultiple(client, 'legacy_zset', rows, ['_key', 'value'], 'score');

			// Read back per-input scores in input order via a single
			// SQL round-trip; the helper preserves order with no JS-side
			// reconstruction.
			const lookup = data.map(([key, , rawValue]) => ({ _key: key, value: String(rawValue) }));
			const result = await helpers.fetchOrderedRows(client, 'legacy_zset', lookup, ['_key', 'value'], ['score']);
			return result.map(r => (r.score == null ? undefined : parseFloat(r.score)));
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

		let query = helpers.createZsetQuery()
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

		let query = helpers.createZsetQuery()
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
		// Single DELETE — no SELECT-then-DELETE race. The EXISTS subquery
		// preserves the original create*Query semantics (type='zset' and
		// not-expired); without it expired or mistyped rows would be deleted
		// even though the API contract treats those keys as nonexistent.
		const now = new Date().toISOString();
		let query = module.db.deleteFrom('legacy_zset')
			.where('_key', '=', key)
			.where(eb => eb.exists(
				eb.selectFrom('legacy_object as o')
					.select(eb2 => eb2.lit(1).as('x'))
					.where('o._key', '=', key)
					.where('o.type', '=', 'zset')
					.where(eb2 => eb2.or([
						eb2('o.expireAt', 'is', null),
						eb2('o.expireAt', '>', now),
					])),
			));
		query = helpers.applyLexConditions(query, min, max, 'value');
		await query.execute();
	};

	module.getSortedSetScan = async function (params) {
		const { key, match, limit, withScores } = params;

		if (!key) {
			return [];
		}

		const pattern = helpers.buildLikePattern(match);

		let query = helpers.createZsetQuery()
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

		// Promisify callback-based process functions (like batch.js does for other DBs)
		if (processFn && processFn.constructor && processFn.constructor.name !== 'AsyncFunction') {
			processFn = util.promisify(processFn);
		}

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