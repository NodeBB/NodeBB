'use strict';

const _ = require('lodash');
const { sql } = require('kysely');

// Two-arm dialect dispatch:
//   onDup       → MySQL  `ON DUPLICATE KEY UPDATE` + `VALUES(col)`
//   onConflict  → PG / SQLite  `ON CONFLICT (...) DO UPDATE` + `excluded.col`
// `features.merge` is detected but never enabled by the connection layer, so
// only the two paths above are reachable.
module.exports = function (module) {
	const ctx = () => module.context || { dialect: module.dialect, features: module.features };
	const useOnDup = () => {
		const { dialect, features } = ctx();
		return !!features?.onDuplicateKey || (!features?.onConflict && dialect === 'mysql');
	};
	const nowIso = () => new Date().toISOString();

	// =============================================================================
	// PURE HELPERS
	// =============================================================================

	const buildLikePattern = match => (match ? match.replace(/\*/g, '%').replace(/\?/g, '_') : '%');

	const whereNotExpired = (query, alias, now = nowIso()) => {
		const col = alias ? `${alias}.expireAt` : 'expireAt';
		return query.where(eb => eb.or([eb(col, 'is', null), eb(col, '>', now)]));
	};

	const mapResultsToKeys = (keys, rows, keyCol, valueCol, def = null) => {
		const map = _.keyBy(rows, keyCol);
		return keys.map(k => (k in map ? map[k][valueCol] : def));
	};

	const mapResultsToKeysArray = (keys, rows, keyCol, extract) => {
		const grouped = _.groupBy(rows, keyCol);
		return keys.map(k => (grouped[k] || []).map(extract));
	};

	const mapCountsToKeys = (keys, rows, keyCol, countCol) => {
		const map = _.keyBy(rows, keyCol);
		return keys.map(k => (k in map ? parseInt(map[k][countCol], 10) : 0));
	};

	const aggregateScores = (scores, agg) => (
		agg === 'MIN' ? _.min(scores) :
			agg === 'MAX' ? _.max(scores) :
				_.sum(scores)
	);

	const createWeightMap = (sets, weights = []) =>
		_.zipObject(sets, sets.map((_set, i) => weights[i] ?? 1));

	const getWeight = (map, key) => _.get(map, key, 1);

	// '-' / '+'  → range sentinel; '(x' / '[x' → exclusive / inclusive bound;
	// bare 'x' → inclusive bound (legacy NodeBB convention).
	const parseLexRange = v => (
		v === '-' ? { value: null, op: null, isMin: true } :
			v === '+' ? { value: null, op: null, isMax: true } :
				v[0] === '(' ? { value: v.slice(1), inclusive: false } :
					v[0] === '[' ? { value: v.slice(1), inclusive: true } :
						{ value: v, inclusive: true }
	);

	const applyLexConditions = (query, min, max, valueCol = 'z.value') => {
		const lo = parseLexRange(min);
		const hi = parseLexRange(max);
		if (!lo.isMin) query = query.where(valueCol, lo.inclusive ? '>=' : '>', lo.value);
		if (!hi.isMax) query = query.where(valueCol, hi.inclusive ? '<=' : '<', hi.value);
		return query;
	};

	const applyScoreConditions = (query, min, max, scoreCol = 'z.score') => {
		if (min !== '-inf') query = query.where(scoreCol, '>=', parseFloat(min));
		if (max !== '+inf') query = query.where(scoreCol, '<=', parseFloat(max));
		return query;
	};

	const applyPagination = (query, start, count) => {
		if (start > 0) return query.offset(start).limit(count > 0 ? count : Number.MAX_SAFE_INTEGER);
		return count > 0 ? query.limit(count) : query;
	};

	const sliceWithNegativeIndices = (results, start, stop) => {
		const len = results.length;
		if (!len) return [];
		const s = start < 0 ? Math.max(0, len + start) : start;
		const e = stop < 0 ? len + stop : stop;
		return s > e || s >= len ? [] : results.slice(s, e + 1);
	};

	// Composite-key dedupe: keep the last occurrence per (col1, col2, ...) tuple.
	// Nested Maps walk one level per key column, so distinct tuples land in
	// distinct leaves — no string stringification, no delimiter, no collision.
	const deduplicateRows = (rows, keyColumns) => {
		const root = new Map();
		const last = keyColumns.length - 1;
		for (const row of rows) {
			let node = root;
			for (let i = 0; i < last; i++) {
				const k = row[keyColumns[i]];
				if (!node.has(k)) node.set(k, new Map());
				node = node.get(k);
			}
			node.set(row[keyColumns[last]], row);
		}
		const flatten = (node, depth) => (depth === last ?
			[...node.values()] :
			[...node.values()].flatMap(child => flatten(child, depth + 1)));
		return flatten(root, 0);
	};

	// =============================================================================
	// QUERY BUILDERS
	// =============================================================================

	const TYPED_TABLES = {
		Zset: ['legacy_zset', 'z', 'zset'],
		Hash: ['legacy_hash', 'h', 'hash'],
		Set: ['legacy_set', 's', 'set'],
		List: ['legacy_list', 'l', 'list'],
		String: ['legacy_string', 's', 'string'],
	};

	const createObjectQuery = (table, alias, type) => whereNotExpired(
		module.db.selectFrom('legacy_object as o')
			.innerJoin(`${table} as ${alias}`, `${alias}._key`, 'o._key')
			.where('o.type', '=', type),
		'o',
	);

	const createLegacyObjectQuery = () => whereNotExpired(module.db.selectFrom('legacy_object'), null);

	// =============================================================================
	// UPSERT FAMILY
	// =============================================================================

	// All UPSERT variants funnel through this builder. `expr` is an object whose
	// values are either constants or `eb => expression` callbacks; we apply it
	// verbatim on PG/SQLite (`onConflict.doUpdateSet`) and via a per-eb wrapper
	// on MySQL (`onDuplicateKeyUpdate`). When `expr` is null, falls back to
	// `doNothing()` / a self-assignment no-op for MySQL.
	function buildUpsert(db, table, vals, conflictCols, expr) {
		const insert = db.insertInto(table).values(vals);
		if (useOnDup()) {
			if (!expr) {
				const c = conflictCols[0];
				return insert.onDuplicateKeyUpdate(eb => ({ [c]: eb.ref(`${table}.${c}`) }));
			}
			const wrapped = Object.fromEntries(
				Object.entries(expr).map(([k, v]) => [k, typeof v === 'function' ? eb => v(eb) : v]),
			);
			return insert.onDuplicateKeyUpdate(wrapped);
		}
		return insert.onConflict(oc => (expr ?
			oc.columns(conflictCols).doUpdateSet(expr) :
			oc.columns(conflictCols).doNothing()));
	}

	async function upsert(db, table, values, conflictColumns, updateValues) {
		const expr = updateValues && Object.keys(updateValues).length ? updateValues : null;
		await buildUpsert(db, table, values, conflictColumns, expr).execute();
	}

	// MySQL: VALUES(col); PG/SQLite: excluded.col.
	const insertedRef = col => (useOnDup() ?
		eb => eb.fn('VALUES', [eb.ref(col)]) :
		eb => eb.ref(`excluded.${col}`));

	const SQLITE_CHUNK_SIZE = 100;

	async function upsertMultipleBatch(db, table, rows, conflictColumns, updateColumns) {
		const expr = updateColumns.length ?
			Object.fromEntries(updateColumns.map(c => [c, insertedRef(c)])) :
			null;
		await buildUpsert(db, table, rows, conflictColumns, expr).execute();
	}

	async function upsertMultiple(db, table, rows, conflictColumns, updateColumns) {
		if (!rows?.length) return;
		if (rows.length === 1) {
			const [row] = rows;
			const updates = Object.fromEntries(
				updateColumns.filter(c => c in row).map(c => [c, row[c]]),
			);
			return await upsert(db, table, row, conflictColumns, updates);
		}
		const chunkSize = ctx().dialect === 'sqlite' ? SQLITE_CHUNK_SIZE : 1000;
		for (let i = 0; i < rows.length; i += chunkSize) {
			// eslint-disable-next-line no-await-in-loop
			await upsertMultipleBatch(db, table, rows.slice(i, i + chunkSize), conflictColumns, updateColumns);
		}
	}

	const insertMultiple = async (db, table, rows) => {
		if (rows?.length) await db.insertInto(table).values(rows).execute();
	};

	// Atomic add: existing.sumCol + inserted.sumCol — DB-evaluated, no race.
	// Caller MUST pre-fold duplicate (conflict-target) rows; a single statement
	// may not update the same row twice.
	const upsertAddMultiple = async (db, table, rows, conflictColumns, sumColumn) => {
		if (!rows?.length) return;
		const incoming = insertedRef(sumColumn);
		await buildUpsert(db, table, rows, conflictColumns, {
			[sumColumn]: eb => eb(`${table}.${sumColumn}`, '+', incoming(eb)),
		}).execute();
	};

	// Type-tagged numeric add (legacy_hash pattern: TEXT `value` + CHAR(1) `value_type`).
	// On conflict, casts existing value to numeric (or 0 if non-numeric) and adds the
	// incoming numeric, then re-casts to text. Cast type names are the only `sql.raw`
	// bits since Kysely's typed `cast` doesn't normalise them across dialects.
	const buildTypedAddExpr = (table) => {
		const onDup = useOnDup();
		const numType = onDup ? sql.raw('DECIMAL(20,4)') : 'real';
		const txtType = onDup ? sql.raw('CHAR') : 'text';
		const incoming = insertedRef('value');
		return eb => eb.cast(
			eb(
				eb.case().when(`${table}.value_type`, '=', 'n')
					.then(eb.cast(eb.ref(`${table}.value`), numType))
					.else(eb.lit(0)).end(),
				'+',
				eb.cast(incoming(eb), numType),
			),
			txtType,
		);
	};

	const typedAddExprFor = table => ({ value: buildTypedAddExpr(table), value_type: 'n' });

	const upsertAddTypedMultiple = async (db, table, rows, conflictColumns) => {
		if (!rows?.length) return;
		await buildUpsert(db, table, rows, conflictColumns, typedAddExprFor(table)).execute();
	};

	// Single-row variant returning the post-update numeric value. PG/SQLite use
	// RETURNING; MySQL has no RETURNING so we re-SELECT (still inside the caller's
	// transaction, so the read is consistent).
	async function upsertAddTyped(db, table, row, conflictColumns) {
		const builder = buildUpsert(db, table, row, conflictColumns, typedAddExprFor(table));
		if (useOnDup()) {
			await builder.execute();
			const reread = await conflictColumns.reduce(
				(q, c) => q.where(c, '=', row[c]),
				db.selectFrom(table).select('value'),
			).executeTakeFirst();
			return Number(reread.value);
		}
		const r = await builder.returning(['value']).executeTakeFirst();
		return Number(r.value);
	}

	// =============================================================================
	// ORDERED-INPUT QUERIES (single round-trip per logical N-ary lookup)
	// =============================================================================

	// Build a virtual input table from `lookup` via UNION-ALL of single-row
	// SELECTs. Works on MySQL 5.6 (no VALUES table-source, no CTE).
	function inputTable(db, lookup, valColumns) {
		return lookup
			.map((row, ord) => db.selectNoFrom(eb => [
				eb.val(ord).as('__ord'),
				...valColumns.map(c => eb.val(row[c]).as(c)),
			]))
			.reduce((acc, q) => acc.unionAll(q));
	}

	// LEFT JOIN a synthesised lookup table to `table` on `joinColumns`, returning
	// one row per input in order, with selected columns null-filled when no match.
	// `notExpired` adds a parallel join on legacy_object to filter expired keys.
	async function fetchOrderedRows(db, table, lookup, joinColumns, selectColumns, options = {}) {
		if (!lookup?.length) return [];
		let query = db
			.selectFrom(inputTable(db, lookup, joinColumns).as('__in'))
			.leftJoin(`${table} as __t`, j => joinColumns.reduce(
				(jj, c) => jj.onRef(`__t.${c}`, '=', `__in.${c}`), j,
			));
		if (options.notExpired) {
			const now = nowIso();
			query = query
				.leftJoin('legacy_object as __o', '__o._key', '__t._key')
				.where(eb => eb.or([
					eb('__t._key', 'is', null),
					eb('__o.expireAt', 'is', null),
					eb('__o.expireAt', '>', now),
				]));
		}
		return await query
			.select(selectColumns.map(c => `__t.${c}`))
			.orderBy('__in.__ord')
			.execute();
	}

	// Per-input zset rank (or null if absent). Tie-break on lexical value, matching
	// Redis ZRANK / ZREVRANK semantics. `isReverse` flips comparison direction.
	async function computeRanks(db, lookup, isReverse) {
		if (!lookup?.length) return [];
		const cmp = isReverse ? '>' : '<';
		const now = nowIso();
		const inputQB = inputTable(
			db, lookup.map(r => ({ __key: r._key, __value: r.value })), ['__key', '__value'],
		);

		const rows = await db
			.selectFrom(inputQB.as('__in'))
			.leftJoin('legacy_zset as __a', j => j
				.onRef('__a._key', '=', '__in.__key')
				.onRef('__a.value', '=', '__in.__value'))
			.leftJoin('legacy_object as __ao', '__ao._key', '__a._key')
			.where(eb => eb.or([
				eb('__a._key', 'is', null),
				eb('__ao.expireAt', 'is', null),
				eb('__ao.expireAt', '>', now),
			]))
			.select([
				'__in.__ord',
				'__a.score as __anchor_score',
				eb => eb.selectFrom('legacy_zset as __b')
					.innerJoin('legacy_object as __bo', '__bo._key', '__b._key')
					.select(eb2 => eb2.fn.countAll().as('c'))
					.whereRef('__b._key', '=', '__in.__key')
					.where(eb2 => eb2.or([
						eb2('__bo.expireAt', 'is', null),
						eb2('__bo.expireAt', '>', now),
					]))
					.where(eb2 => eb2.or([
						eb2('__b.score', cmp, eb2.ref('__a.score')),
						eb2.and([
							eb2('__b.score', '=', eb2.ref('__a.score')),
							eb2('__b.value', cmp, eb2.ref('__in.__value')),
						]),
					]))
					.as('rank_count'),
			])
			.orderBy('__in.__ord')
			.execute();

		return rows.map(r => (r.__anchor_score == null ? null : parseInt(r.rank_count, 10) || 0));
	}

	// =============================================================================
	// LEGACY OBJECT / DELETE / TRANSACTION
	// =============================================================================

	const CHILD_TABLES = ['legacy_string', 'legacy_hash', 'legacy_zset', 'legacy_set', 'legacy_list'];

	// Materialise the "live" view: drop expired rows from legacy_object plus all
	// child tables (no CASCADE in SQLite). Mirrors the PG `legacy_object_live` view.
	async function deleteExpiredKeys(db, keys) {
		if (!keys?.length) return;
		const now = nowIso();
		const expired = (await db.selectFrom('legacy_object').select('_key')
			.where('_key', 'in', keys)
			.where('expireAt', 'is not', null)
			.where('expireAt', '<=', now).execute()).map(r => r._key);
		if (!expired.length) return;
		await Promise.all(CHILD_TABLES.map(t => db.deleteFrom(t)
			.where('_key', 'in', expired).execute().catch(() => {})));
		await db.deleteFrom('legacy_object').where('_key', 'in', expired).execute();
	}

	async function ensureLegacyObjectsType(db, keys, type) {
		if (!keys?.length) return;
		await deleteExpiredKeys(db, keys);
		await upsertMultiple(db, 'legacy_object', keys.map(_key => ({ _key, type })), ['_key'], ['type']);
	}

	async function ensureLegacyObjectType(db, key, type) {
		if (!key) return;
		await ensureLegacyObjectsType(db, [key], type);
		const r = await db.selectFrom('legacy_object').select('type')
			.where('_key', '=', key)
			.where(eb => eb.or([eb('expireAt', 'is', null), eb('expireAt', '>', nowIso())]))
			.executeTakeFirst();
		if (r && r.type !== type) {
			throw new Error(`database: cannot insert ${JSON.stringify(key)} as ${type} because it already exists as ${r.type}`);
		}
	}

	const deleteByKey = (db, table, key) =>
		db.deleteFrom(table).where('_key', '=', key).execute();

	const deleteByKeys = async (db, table, keys) => {
		if (keys?.length) await db.deleteFrom(table).where('_key', 'in', keys).execute();
	};

	const withTransaction = (key, type, fn) => module.transaction(async (client) => {
		if (key) await ensureLegacyObjectType(client, key, type);
		return await fn(client);
	});

	const withTransactionKeys = (keys, type, fn) => module.transaction(async (client) => {
		if (keys?.length) await ensureLegacyObjectsType(client, keys, type);
		return await fn(client);
	});

	// =============================================================================
	// EXPORT
	// =============================================================================

	const queryBuilders = Object.fromEntries(
		Object.entries(TYPED_TABLES).map(([name, [tbl, alias, type]]) =>
			[`create${name}Query`, () => createObjectQuery(tbl, alias, type)]),
	);

	module.helpers = {
		buildLikePattern,
		whereNotExpired,
		mapResultsToKeys,
		mapResultsToKeysArray,
		mapCountsToKeys,
		aggregateScores,
		createWeightMap,
		getWeight,
		parseLexRange,
		applyLexConditions,
		applyScoreConditions,
		applyPagination,
		sliceWithNegativeIndices,
		deduplicateRows,

		createObjectQuery,
		...queryBuilders,
		createLegacyObjectQuery,

		upsert,
		upsertMultiple,
		upsertAddMultiple,
		upsertAddTyped,
		upsertAddTypedMultiple,
		insertMultiple,
		fetchOrderedRows,
		computeRanks,

		ensureLegacyObjectType,
		ensureLegacyObjectsType,
		deleteByKey,
		deleteByKeys,
		withTransaction,
		withTransactionKeys,
	};
};
