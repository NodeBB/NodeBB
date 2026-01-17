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
			await chunks.reduce(
				(promise, chunk) => promise.then(() =>
					upsertMultipleBatch(db, table, chunk, conflictColumns, updateColumns)),
				Promise.resolve()
			);
			return;
		}

		await upsertMultipleBatch(db, table, rows, conflictColumns, updateColumns);
	}

	async function insertMultiple(db, table, rows) {
		if (!rows || !rows.length) return;
		await db.insertInto(table).values(rows).execute();
	}

	// =============================================================================
	// LEGACY OBJECT TYPE HELPERS
	// =============================================================================

	async function ensureLegacyObjectType(db, key, type) {
		if (!key) return;
		await upsert(db, 'legacy_object', { _key: key, type: type }, ['_key'], { type: type });
	}

	async function ensureLegacyObjectsType(db, keys, type) {
		if (!keys || !keys.length) return;
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
		insertMultiple,

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
