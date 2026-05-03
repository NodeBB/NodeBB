'use strict';

/**
 * Helpers module - exports a function to extend the database module with bound helpers.
 * This follows the same pattern as other submodules (hash.js, sets.js, etc.)
 *
 * Usage in kysely.js:
 *   require('./kysely/helpers')(kyselyModule);
 *
 * Then in submodules:
 *   const helpers = module.helpers;
 */
module.exports = function (module) {
	const getCtx = () => module.context || { dialect: module.dialect, features: module.features || null };

	// =============================================================================
	// STATIC HELPERS (no context needed, can be used directly)
	// =============================================================================

	/**
	 * Build a LIKE pattern from a glob-style match pattern
	 */
	function buildLikePattern(match) {
		if (!match) {
			return '%';
		}
		return match.replace(/\*/g, '%').replace(/\?/g, '_');
	}

	/**
	 * Add expiry check condition to a query builder
	 */
	function whereNotExpired(query, tableAlias, now) {
		const expireAtCol = tableAlias ? `${tableAlias}.expireAt` : 'expireAt';
		return query.where(eb => eb.or([
			eb(expireAtCol, 'is', null),
			eb(expireAtCol, '>', now),
		]));
	}

	/**
	 * Map database results back to keys array, preserving order
	 */
	function mapResultsToKeys(keys, rows, keyCol, valueCol, defaultValue = null) {
		const map = Object.fromEntries(rows.map(row => [row[keyCol], row[valueCol]]));
		return keys.map(k => (k in map ? map[k] : defaultValue));
	}

	/**
	 * Map database results to keys array, collecting multiple values per key
	 */
	function mapResultsToKeysArray(keys, rows, keyCol, valueExtractor) {
		const map = rows.reduce(
			(acc, row) => ({ ...acc, [row[keyCol]]: [...(acc[row[keyCol]] || []), valueExtractor(row)] }),
			Object.fromEntries(keys.map(k => [k, []]))
		);
		return keys.map(k => map[k]);
	}

	/**
	 * Map count results to keys array
	 */
	function mapCountsToKeys(keys, rows, keyCol, countCol) {
		const map = Object.fromEntries(rows.map(row => [row[keyCol], parseInt(row[countCol], 10)]));
		return keys.map(k => (k in map ? map[k] : 0));
	}

	/**
	 * Aggregate an array of scores using the specified method
	 */
	function aggregateScores(scores, aggregate) {
		if (aggregate === 'MIN') {
			return Math.min(...scores);
		} else if (aggregate === 'MAX') {
			return Math.max(...scores);
		}
		return scores.reduce((a, b) => a + b, 0);
	}

	/**
	 * Create a weight map from sets and weights arrays
	 */
	function createWeightMap(sets, weights = []) {
		const normalizedWeights = [
			...weights.slice(0, sets.length),
			...Array(Math.max(0, sets.length - weights.length)).fill(1),
		];
		return Object.fromEntries(sets.map((set, idx) => [set, normalizedWeights[idx]]));
	}

	/**
	 * Get weight for a key from weight map
	 */
	function getWeight(weightMap, key) {
		return key in weightMap ? weightMap[key] : 1;
	}

	/**
	 * Parse lex range notation
	 */
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
		return { value: value, inclusive: true };
	}

	/**
	 * Apply lex range conditions to a query
	 */
	function applyLexConditions(query, min, max, valueCol = 'z.value') {
		const minParsed = parseLexRange(min);
		const maxParsed = parseLexRange(max);

		if (!minParsed.isMin) {
			const op = minParsed.inclusive ? '>=' : '>';
			query = query.where(valueCol, op, minParsed.value);
		}
		if (!maxParsed.isMax) {
			const op = maxParsed.inclusive ? '<=' : '<';
			query = query.where(valueCol, op, maxParsed.value);
		}
		return query;
	}

	/**
	 * Apply score range conditions to a query
	 */
	function applyScoreConditions(query, min, max, scoreCol = 'z.score') {
		if (min !== '-inf') {
			query = query.where(scoreCol, '>=', parseFloat(min));
		}
		if (max !== '+inf') {
			query = query.where(scoreCol, '<=', parseFloat(max));
		}
		return query;
	}

	/**
	 * Apply offset and limit to a query
	 */
	function applyPagination(query, start, count) {
		if (start > 0 && count > 0) {
			query = query.offset(start).limit(count);
		} else if (start > 0) {
			query = query.offset(start).limit(Number.MAX_SAFE_INTEGER);
		} else if (count > 0) {
			query = query.limit(count);
		}
		return query;
	}

	/**
	 * Handle negative indices by slicing
	 */
	function sliceWithNegativeIndices(results, start, stop) {
		const len = results.length;
		if (len === 0) {
			return [];
		}

		const startIdx = start < 0 ? Math.max(0, len + start) : start;
		const stopIdx = stop < 0 ? len + stop : stop;

		if (startIdx > stopIdx || startIdx >= len) {
			return [];
		}

		return results.slice(startIdx, stopIdx + 1);
	}

	/**
	 * Deduplicate rows by key columns, keeping the last occurrence.
	 */
	function deduplicateRows(rows, keyColumns) {
		if (keyColumns.length === 1) {
			return [...rows.reduce(
				(map, row) => map.set(row[keyColumns[0]], row),
				new Map()
			).values()];
		}
		const root = rows.reduce((map, row) => {
			const path = keyColumns.slice(0, -1);
			const leaf = keyColumns[keyColumns.length - 1];
			const target = path.reduce(
				(m, col) => m.get(row[col]) || m.set(row[col], new Map()).get(row[col]),
				map
			);
			target.set(row[leaf], row);
			return map;
		}, new Map());

		const collect = (map, depth) => (depth === keyColumns.length - 1 ?
			[...map.values()] :
			[...map.values()].flatMap(m => collect(m, depth + 1)));
		return collect(root, 0);
	}

	// =============================================================================
	// QUERY BUILDER FACTORIES (bound to module's db and dialect)
	// =============================================================================

	function createObjectQuery(joinTable, joinAlias, type) {
		const now = new Date().toISOString();
		let query = module.db.selectFrom('legacy_object as o')
			.innerJoin(`${joinTable} as ${joinAlias}`, `${joinAlias}._key`, 'o._key')
			.where('o.type', '=', type);
		query = whereNotExpired(query, 'o', now);
		return query;
	}

	function createZsetQuery() {
		return createObjectQuery('legacy_zset', 'z', 'zset');
	}

	function createHashQuery() {
		return createObjectQuery('legacy_hash', 'h', 'hash');
	}

	function createSetQuery() {
		return createObjectQuery('legacy_set', 's', 'set');
	}

	function createListQuery() {
		return createObjectQuery('legacy_list', 'l', 'list');
	}

	function createStringQuery() {
		return createObjectQuery('legacy_string', 's', 'string');
	}

	function createLegacyObjectQuery() {
		const now = new Date().toISOString();
		let query = module.db.selectFrom('legacy_object');
		query = whereNotExpired(query, null, now);
		return query;
	}

	// =============================================================================
	// UPSERT HELPERS (bound with automatic context)
	// =============================================================================

	// Internal upsert implementations
	async function upsertMySQL(db, table, values, updateValues) {
		const hasUpdates = updateValues && Object.keys(updateValues).length > 0;
		const update = hasUpdates ? updateValues : { _key: values._key };
		await db.insertInto(table).values(values).onDuplicateKeyUpdate(update).execute();
	}

	async function upsertOnConflict(db, table, values, conflictColumns, updateValues) {
		await db.insertInto(table)
			.values(values)
			.onConflict((oc) => {
				const cols = oc.columns(conflictColumns);
				const hasUpdates = updateValues && Object.keys(updateValues).length > 0;
				return hasUpdates ? cols.doUpdateSet(updateValues) : cols.doNothing();
			})
			.execute();
	}

	async function executeMerge(db, table, values, conflictColumns, updateValues) {
		const hasUpdates = updateValues && Object.keys(updateValues).length > 0;
		const columns = Object.keys(values);

		const sourceQuery = db.selectNoFrom(eb => columns.map(col => eb.val(values[col]).as(col)));

		const mergeQuery = db.mergeInto(`${table} as target`)
			.using(sourceQuery.as('source'), join =>
				conflictColumns.reduce(
					(j, col) => j.onRef(`target.${col}`, '=', `source.${col}`),
					join
				));

		const withMatched = hasUpdates ?
			mergeQuery.whenMatched().thenUpdateSet(updateValues) :
			mergeQuery;

		const insertValues = Object.fromEntries(
			columns.map(col => [col, eb => eb.ref(`source.${col}`)])
		);

		await withMatched.whenNotMatched().thenInsertValues(insertValues).execute();
	}

	async function upsert(db, table, values, conflictColumns, updateValues) {
		const { dialect, features } = getCtx();

		if (features?.onDuplicateKey) {
			return await upsertMySQL(db, table, values, updateValues);
		}
		if (features?.onConflict) {
			return await upsertOnConflict(db, table, values, conflictColumns, updateValues);
		}
		if (features?.merge) {
			return await executeMerge(db, table, values, conflictColumns, updateValues);
		}

		// Fallback based on dialect
		return dialect === 'mysql' ?
			await upsertMySQL(db, table, values, updateValues) :
			await upsertOnConflict(db, table, values, conflictColumns, updateValues);
	}

	// Batch upsert implementations
	async function upsertBatchMySQL(db, table, rows, conflictColumns, updateColumns) {
		const updateSet = updateColumns.length > 0 ?
			Object.fromEntries(updateColumns.map(col => [col, eb => eb.fn('VALUES', [eb.ref(col)])])) :
			{ [conflictColumns[0]]: eb => eb.fn('VALUES', [eb.ref(conflictColumns[0])]) };
		await db.insertInto(table).values(rows).onDuplicateKeyUpdate(updateSet).execute();
	}

	async function upsertBatchOnConflict(db, table, rows, conflictColumns, updateColumns) {
		await db.insertInto(table)
			.values(rows)
			.onConflict((oc) => {
				const cols = oc.columns(conflictColumns);
				return updateColumns.length > 0 ?
					cols.doUpdateSet(Object.fromEntries(
						updateColumns.map(col => [col, eb => eb.ref(`excluded.${col}`)])
					)) :
					cols.doNothing();
			})
			.execute();
	}

	async function executeMergeBatch(db, table, rows, conflictColumns, updateColumns) {
		// MERGE doesn't support batch operations, process sequentially
		await rows.reduce(
			(promise, row) => promise.then(() => executeMerge(
				db,
				table,
				row,
				conflictColumns,
				Object.fromEntries(updateColumns.filter(col => col in row).map(col => [col, row[col]]))
			)),
			Promise.resolve()
		);
	}

	const SQLITE_CHUNK_SIZE = 100;

	async function upsertMultipleBatch(db, table, rows, conflictColumns, updateColumns) {
		const { dialect, features } = getCtx();

		if (features?.onDuplicateKey) {
			return await upsertBatchMySQL(db, table, rows, conflictColumns, updateColumns);
		}
		if (features?.onConflict) {
			return await upsertBatchOnConflict(db, table, rows, conflictColumns, updateColumns);
		}
		if (features?.merge) {
			return await executeMergeBatch(db, table, rows, conflictColumns, updateColumns);
		}

		// Fallback based on dialect
		return dialect === 'mysql' ?
			await upsertBatchMySQL(db, table, rows, conflictColumns, updateColumns) :
			await upsertBatchOnConflict(db, table, rows, conflictColumns, updateColumns);
	}

	async function upsertMultiple(db, table, rows, conflictColumns, updateColumns) {
		if (!rows?.length) return;

		// Single row optimization
		if (rows.length === 1) {
			const [row] = rows;
			const updateValues = Object.fromEntries(
				updateColumns.filter(col => col in row).map(col => [col, row[col]])
			);
			return await upsert(db, table, row, conflictColumns, updateValues);
		}

		const { dialect } = getCtx();
		const chunkSize = dialect === 'sqlite' ? SQLITE_CHUNK_SIZE : 1000;

		// Process in chunks if needed
		if (rows.length > chunkSize) {
			const chunks = Array.from(
				{ length: Math.ceil(rows.length / chunkSize) },
				(_, i) => rows.slice(i * chunkSize, (i + 1) * chunkSize)
			);
			for (const chunk of chunks) {
				// eslint-disable-next-line no-await-in-loop
				await upsertMultipleBatch(db, table, chunk, conflictColumns, updateColumns);
			}
			return;
		}

		await upsertMultipleBatch(db, table, rows, conflictColumns, updateColumns);
	}

	async function insertMultiple(db, table, rows) {
		if (!rows || !rows.length) return;
		await db.insertInto(table).values(rows).execute();
	}

	// ---------------------------------------------------------------------------
	// Atomic ADD-on-conflict (DB-side increment).
	// ---------------------------------------------------------------------------
	// `upsertAddMultiple` inserts `rows` and, on conflict, ADDS the supplied
	// numeric value to the existing one — all evaluated by the database, so
	// there is no SELECT-then-UPDATE race window. Caller must pre-fold rows
	// with the same conflict target (a single statement may not update the
	// same row twice).
	//
	//   - MySQL 5.6+   `ON DUPLICATE KEY UPDATE c = c + VALUES(c)`
	//                  (`AS new_v` row-alias is 8.0.20+ only — `VALUES()` is
	//                  the portable form, supported on every version)
	//   - Postgres / SQLite  `ON CONFLICT (…) DO UPDATE SET c = t.c + excluded.c`
	async function upsertAddMultipleMySQL(db, table, rows, sumColumn) {
		await db.insertInto(table).values(rows).onDuplicateKeyUpdate(eb => ({
			[sumColumn]: eb(`${table}.${sumColumn}`, '+', eb.fn('VALUES', [eb.ref(sumColumn)])),
		})).execute();
	}

	async function upsertAddMultipleOnConflict(db, table, rows, conflictColumns, sumColumn) {
		await db.insertInto(table).values(rows)
			.onConflict(oc => oc.columns(conflictColumns).doUpdateSet({
				[sumColumn]: eb => eb(`${table}.${sumColumn}`, '+', eb.ref(`excluded.${sumColumn}`)),
			}))
			.execute();
	}

	async function upsertAddMultiple(db, table, rows, conflictColumns, sumColumn) {
		if (!rows?.length) return;
		const { dialect, features } = getCtx();
		const useMysql = features?.onDuplicateKey || (!features?.onConflict && dialect === 'mysql');
		return useMysql ?
			upsertAddMultipleMySQL(db, table, rows, sumColumn) :
			upsertAddMultipleOnConflict(db, table, rows, conflictColumns, sumColumn);
	}

	// ---------------------------------------------------------------------------
	// Ordered batch lookup.
	// ---------------------------------------------------------------------------
	// `fetchOrderedRows` returns one row per `lookup` entry, in lookup order,
	// joining each lookup tuple against `table` on `joinColumns`. Missing
	// matches yield rows whose selected columns are all `null`. The input
	// table is synthesised inline as a UNION-ALL of single-row SELECTs so
	// the technique works on MySQL 5.6 too (which has no VALUES table-source).
	// Pure Kysely, no raw SQL, no dialect-specific aggregates.
	//
	// Options:
	//   notExpired: if true, additionally LEFT JOIN `legacy_object` on the
	//   matched row's `_key` and filter out rows whose key has expired.
	//   This matches the semantics of `helpers.whereNotExpired` used by the
	//   `create*Query` builders.
	async function fetchOrderedRows(db, table, lookup, joinColumns, selectColumns, options = {}) {
		if (!lookup?.length) return [];
		const inputRows = lookup.map((row, ord) =>
			db.selectNoFrom(eb => [
				eb.val(ord).as('__ord'),
				...joinColumns.map(col => eb.val(row[col]).as(col)),
			]));
		const inputQB = inputRows.reduce((acc, q) => acc.unionAll(q));
		let query = db
			.selectFrom(inputQB.as('__in'))
			.leftJoin(`${table} as __t`, join => joinColumns.reduce(
				(j, col) => j.onRef(`__t.${col}`, '=', `__in.${col}`),
				join,
			));
		if (options.notExpired) {
			const now = new Date().toISOString();
			query = query
				.leftJoin('legacy_object as __o', '__o._key', '__t._key')
				.where(eb => eb.or([
					eb('__t._key', 'is', null),
					eb('__o.expireAt', 'is', null),
					eb('__o.expireAt', '>', now),
				]));
		}
		return await query
			.select(selectColumns.map(col => `__t.${col}`))
			.orderBy('__in.__ord')
			.execute();
	}

	// ---------------------------------------------------------------------------
	// Sorted-set rank in one round-trip.
	// ---------------------------------------------------------------------------
	// `computeRanks` returns a per-input rank (or null if the value isn't in
	// the named zset) — one row per lookup entry, in lookup order, in a
	// single SQL statement. Replaces the `Promise.all(keys.map(rank))` fan-
	// out which costs 2N round-trips.
	//
	// Standard SQL only:
	//   - synthesise input table via UNION-ALL of selectNoFrom (MySQL 5.6 OK)
	//   - LEFT JOIN to find the anchor row (its score)
	//   - scalar correlated COUNT subquery for "how many smaller ranked"
	//   - tie-break on value lexicographically (matches Redis ZRANK semantics)
	// `isReverse` flips the comparison direction for ZREVRANK.
	async function computeRanks(db, lookup, isReverse) {
		if (!lookup?.length) return [];
		const inputRows = lookup.map((row, ord) =>
			db.selectNoFrom(eb => [
				eb.val(ord).as('__ord'),
				eb.val(row._key).as('__key'),
				eb.val(row.value).as('__value'),
			]));
		const inputQB = inputRows.reduce((acc, q) => acc.unionAll(q));
		const cmp = isReverse ? '>' : '<';
		const now = new Date().toISOString();

		const result = await db
			.selectFrom(inputQB.as('__in'))
			.leftJoin('legacy_zset as __a', join => join
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

		return result.map(r => (r.__anchor_score == null ? null : parseInt(r.rank_count, 10) || 0));
	}

	// =============================================================================
	// LEGACY OBJECT TYPE HELPERS
	// =============================================================================

	// Child tables that need to be cleaned up when a key expires
	const CHILD_TABLES = ['legacy_string', 'legacy_hash', 'legacy_zset', 'legacy_set', 'legacy_list'];

	/**
	 * Delete expired keys from legacy_object and all child tables.
	 * This matches the behavior of the PostgreSQL implementation which uses
	 * a view (legacy_object_live) that filters expired entries.
	 */
	async function deleteExpiredKeys(db, keys) {
		if (!keys || !keys.length) return;

		const now = new Date().toISOString();

		// Find which keys are expired
		const expiredResult = await db.selectFrom('legacy_object')
			.select('_key')
			.where('_key', 'in', keys)
			.where('expireAt', 'is not', null)
			.where('expireAt', '<=', now)
			.execute();

		const expiredKeys = expiredResult.map(r => r._key);
		if (!expiredKeys.length) return;

		// Delete from all child tables first (no CASCADE in SQLite)
		await Promise.all(CHILD_TABLES.map(table => db.deleteFrom(table)
			.where('_key', 'in', expiredKeys)
			.execute()
			.catch(() => {}))); // Ignore if table doesn't exist or key not found

		// Then delete from legacy_object
		await db.deleteFrom('legacy_object')
			.where('_key', 'in', expiredKeys)
			.execute();
	}

	/**
	 * Ensure a key exists in legacy_object with the given type.
	 * First deletes expired entries for this key (and its data), then upserts.
	 * This matches the behavior of the PostgreSQL implementation.
	 */
	async function ensureLegacyObjectType(db, key, type) {
		if (!key) return;

		// Delete expired entry for this key (including from child tables)
		await deleteExpiredKeys(db, [key]);

		// Now upsert the key with the type
		await upsert(db, 'legacy_object', { _key: key, type: type }, ['_key'], { type: type });

		// Verify the type matches (like Postgres does)
		const now = new Date().toISOString();
		const result = await db.selectFrom('legacy_object')
			.select('type')
			.where('_key', '=', key)
			.where(eb => eb.or([
				eb('expireAt', 'is', null),
				eb('expireAt', '>', now),
			]))
			.executeTakeFirst();

		if (result && result.type !== type) {
			throw new Error(`database: cannot insert ${JSON.stringify(key)} as ${type} because it already exists as ${result.type}`);
		}
	}

	/**
	 * Ensure multiple keys exist in legacy_object with the given type.
	 * First deletes expired entries (and their data), then upserts.
	 */
	async function ensureLegacyObjectsType(db, keys, type) {
		if (!keys || !keys.length) return;

		// Delete expired entries for these keys (including from child tables)
		await deleteExpiredKeys(db, keys);

		// Now upsert all keys
		const rows = keys.map(key => ({ _key: key, type: type }));
		await upsertMultiple(db, 'legacy_object', rows, ['_key'], ['type']);
	}

	// =============================================================================
	// DELETE HELPERS
	// =============================================================================

	async function deleteByKey(db, table, key) {
		await db.deleteFrom(table).where('_key', '=', key).execute();
	}

	async function deleteByKeys(db, table, keys) {
		if (!keys || !keys.length) return;
		await db.deleteFrom(table).where('_key', 'in', keys).execute();
	}

	// =============================================================================
	// TRANSACTION HELPERS
	// =============================================================================

	async function withTransaction(key, type, fn) {
		return await module.transaction(async (client) => {
			if (key) {
				await ensureLegacyObjectType(client, key, type);
			}
			return await fn(client);
		});
	}

	async function withTransactionKeys(keys, type, fn) {
		return await module.transaction(async (client) => {
			if (keys && keys.length) {
				await ensureLegacyObjectsType(client, keys, type);
			}
			return await fn(client);
		});
	}

	// =============================================================================
	// BIND ALL HELPERS TO MODULE
	// =============================================================================

	module.helpers = {
		// Static helpers (no context needed)
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

		// Query builders (bound to module's db)
		createObjectQuery,
		createZsetQuery,
		createHashQuery,
		createSetQuery,
		createListQuery,
		createStringQuery,
		createLegacyObjectQuery,

		// Upsert methods (automatic context)
		upsert,
		upsertMultiple,
		upsertAddMultiple,
		insertMultiple,
		fetchOrderedRows,
		computeRanks,

		// Legacy object type helpers
		ensureLegacyObjectType,
		ensureLegacyObjectsType,

		// Delete helpers
		deleteByKey,
		deleteByKeys,

		// Transaction helpers (simplified signature)
		withTransaction,
		withTransactionKeys,
	};
};
