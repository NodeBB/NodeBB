'use strict';

const helpers = module.exports;

// =============================================================================
// VALUE CONVERSION HELPERS
// =============================================================================

/**
 * Convert a value to string for storage
 */
helpers.valueToString = function (value) {
	return String(value);
};

/**
 * Get the current timestamp for the dialect
 */
helpers.getCurrentTimestamp = function (dialect) {
	if (dialect === 'sqlite') {
		return new Date().toISOString();
	}
	return new Date();
};

/**
 * Get the expireAt timestamp value for the dialect
 */
helpers.getExpireAtTimestamp = function (date, dialect) {
	if (dialect === 'sqlite') {
		return date.toISOString();
	}
	return date;
};

/**
 * Build a LIKE pattern from a glob-style match pattern
 */
helpers.buildLikePattern = function (match) {
	if (!match) {
		return '%';
	}
	// Replace glob wildcards with SQL LIKE wildcards
	return match.replace(/\*/g, '%').replace(/\?/g, '_');
};

// =============================================================================
// EXPIRY CONDITION HELPER
// =============================================================================

/**
 * Add expiry check condition to a query builder
 * @param {object} query - Kysely query builder
 * @param {string} tableAlias - Table alias (e.g., 'o' for legacy_object)
 * @param {any} now - Current timestamp value
 * @returns {object} Query builder with expiry condition added
 */
helpers.whereNotExpired = function (query, tableAlias, now) {
	const expireAtCol = tableAlias ? `${tableAlias}.expireAt` : 'expireAt';
	return query.where(eb => eb.or([
		eb(expireAtCol, 'is', null),
		eb(expireAtCol, '>', now),
	]));
};

// =============================================================================
// QUERY BUILDER FACTORIES
// =============================================================================

/**
 * Create a base query builder that selects from legacy_object with a join
 * and includes expiry check
 * 
 * @param {object} db - Kysely database instance
 * @param {string} dialect - Database dialect
 * @param {string} joinTable - Table to join (e.g., 'legacy_zset', 'legacy_hash')
 * @param {string} joinAlias - Alias for the join table (e.g., 'z', 'h')
 * @param {string} type - Object type (e.g., 'zset', 'hash', 'set', 'list', 'string')
 * @returns {object} Kysely query builder
 */
helpers.createObjectQuery = function (db, dialect, joinTable, joinAlias, type) {
	const now = helpers.getCurrentTimestamp(dialect);
	let query = db.selectFrom('legacy_object as o')
		.innerJoin(`${joinTable} as ${joinAlias}`, `${joinAlias}._key`, 'o._key')
		.where('o.type', '=', type);
	query = helpers.whereNotExpired(query, 'o', now);
	return query;
};

/**
 * Create a zset query builder with expiry check
 */
helpers.createZsetQuery = function (db, dialect) {
	return helpers.createObjectQuery(db, dialect, 'legacy_zset', 'z', 'zset');
};

/**
 * Create a hash query builder with expiry check
 */
helpers.createHashQuery = function (db, dialect) {
	return helpers.createObjectQuery(db, dialect, 'legacy_hash', 'h', 'hash');
};

/**
 * Create a set query builder with expiry check
 */
helpers.createSetQuery = function (db, dialect) {
	return helpers.createObjectQuery(db, dialect, 'legacy_set', 's', 'set');
};

/**
 * Create a list query builder with expiry check
 */
helpers.createListQuery = function (db, dialect) {
	return helpers.createObjectQuery(db, dialect, 'legacy_list', 'l', 'list');
};

/**
 * Create a string query builder with expiry check
 */
helpers.createStringQuery = function (db, dialect) {
	return helpers.createObjectQuery(db, dialect, 'legacy_string', 's', 'string');
};

/**
 * Create a query on legacy_object only with expiry check
 */
helpers.createLegacyObjectQuery = function (db, dialect) {
	const now = helpers.getCurrentTimestamp(dialect);
	let query = db.selectFrom('legacy_object');
	query = helpers.whereNotExpired(query, null, now);
	return query;
};

// =============================================================================
// RESULT MAPPING HELPERS
// =============================================================================

/**
 * Map database results back to keys array, preserving order
 * @param {string[]} keys - Original keys array
 * @param {object[]} rows - Database result rows
 * @param {string} keyCol - Column name containing the key (default: '_key')
 * @param {string} valueCol - Column name containing the value to extract
 * @param {any} defaultValue - Default value for missing keys (default: null)
 * @returns {any[]} Array of values in same order as keys
 */
helpers.mapResultsToKeys = function (keys, rows, keyCol, valueCol, defaultValue = null) {
	const map = {};
	rows.forEach((row) => {
		map[row[keyCol]] = row[valueCol];
	});
	return keys.map(k => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : defaultValue));
};

/**
 * Map database results to keys array, collecting multiple values per key
 * @param {string[]} keys - Original keys array
 * @param {object[]} rows - Database result rows
 * @param {string} keyCol - Column name containing the key (default: '_key')
 * @param {function} valueExtractor - Function to extract value from row
 * @returns {any[][]} Array of value arrays in same order as keys
 */
helpers.mapResultsToKeysArray = function (keys, rows, keyCol, valueExtractor) {
	const map = {};
	keys.forEach((k) => { map[k] = []; });
	rows.forEach((row) => {
		if (map[row[keyCol]]) {
			map[row[keyCol]].push(valueExtractor(row));
		}
	});
	return keys.map(k => map[k]);
};

/**
 * Map count results to keys array
 * @param {string[]} keys - Original keys array
 * @param {object[]} rows - Database result rows with count
 * @param {string} keyCol - Column name containing the key
 * @param {string} countCol - Column name containing the count
 * @returns {number[]} Array of counts in same order as keys
 */
helpers.mapCountsToKeys = function (keys, rows, keyCol, countCol) {
	const map = {};
	rows.forEach((row) => {
		map[row[keyCol]] = parseInt(row[countCol], 10);
	});
	return keys.map(k => (Object.prototype.hasOwnProperty.call(map, k) ? map[k] : 0));
};

// =============================================================================
// SCORE AGGREGATION HELPERS (for union/intersect)
// =============================================================================

/**
 * Aggregate an array of scores using the specified method
 * @param {number[]} scores - Array of scores
 * @param {string} aggregate - Aggregation method: 'SUM', 'MIN', 'MAX'
 * @returns {number} Aggregated score
 */
helpers.aggregateScores = function (scores, aggregate) {
	if (aggregate === 'MIN') {
		return Math.min(...scores);
	} else if (aggregate === 'MAX') {
		return Math.max(...scores);
	}
	// Default to SUM
	return scores.reduce((a, b) => a + b, 0);
};

/**
 * Create a weight map from sets and weights arrays
 * @param {string[]} sets - Array of set keys
 * @param {number[]} weights - Array of weights (will be padded with 1s if shorter)
 * @returns {object} Map of set key to weight
 */
helpers.createWeightMap = function (sets, weights = []) {
	if (sets.length < weights.length) {
		weights = weights.slice(0, sets.length);
	}
	while (sets.length > weights.length) {
		weights.push(1);
	}
	const weightMap = {};
	sets.forEach((set, idx) => {
		weightMap[set] = weights[idx];
	});
	return weightMap;
};

/**
 * Get weight for a key from weight map (handles 0 weights correctly)
 * @param {object} weightMap - Weight map created by createWeightMap
 * @param {string} key - Set key to look up
 * @returns {number} Weight value
 */
helpers.getWeight = function (weightMap, key) {
	return Object.prototype.hasOwnProperty.call(weightMap, key) ? weightMap[key] : 1;
};

// =============================================================================
// LEGACY OBJECT TYPE HELPERS
// =============================================================================

/**
 * Ensure a key exists in legacy_object with the given type
 */
helpers.ensureLegacyObjectType = async function (db, key, type, dialect) {
	if (!key) return;

	await helpers.upsert(db, 'legacy_object', {
		_key: key,
		type: type,
	}, ['_key'], { type: type }, dialect);
};

/**
 * Ensure multiple keys exist in legacy_object with the given type
 */
helpers.ensureLegacyObjectsType = async function (db, keys, type, dialect) {
	if (!keys || !keys.length) return;

	for (const key of keys) {
		await helpers.ensureLegacyObjectType(db, key, type, dialect);
	}
};

// =============================================================================
// UPSERT HELPERS
// =============================================================================

/**
 * Unified upsert function for all dialects
 * @param {object} db - Kysely database instance or transaction
 * @param {string} table - Table name
 * @param {object} values - Values to insert
 * @param {string[]} conflictColumns - Columns that define the conflict (primary key)
 * @param {object} updateValues - Values to update on conflict
 * @param {string} dialect - Database dialect (mysql, postgres, sqlite)
 */
helpers.upsert = async function (db, table, values, conflictColumns, updateValues, dialect) {
	const hasUpdates = updateValues && Object.keys(updateValues).length > 0;

	if (dialect === 'mysql') {
		// MySQL uses ON DUPLICATE KEY UPDATE
		if (hasUpdates) {
			await db.insertInto(table)
				.values(values)
				.onDuplicateKeyUpdate(updateValues)
				.execute();
		} else {
			// MySQL: INSERT IGNORE equivalent using ON DUPLICATE KEY UPDATE with no-op
			await db.insertInto(table)
				.values(values)
				.onDuplicateKeyUpdate({ _key: values._key })
				.execute();
		}
	} else {
		// PostgreSQL and SQLite use ON CONFLICT
		if (hasUpdates) {
			await db.insertInto(table)
				.values(values)
				.onConflict(oc => oc.columns(conflictColumns).doUpdateSet(updateValues))
				.execute();
		} else {
			await db.insertInto(table)
				.values(values)
				.onConflict(oc => oc.columns(conflictColumns).doNothing())
				.execute();
		}
	}
};

/**
 * Batch insert with conflict handling
 */
helpers.upsertBatch = async function (db, table, rows, conflictColumns, updateColumns, dialect) {
	if (!rows || !rows.length) return;

	for (const row of rows) {
		const updateValues = {};
		updateColumns.forEach((col) => {
			if (Object.prototype.hasOwnProperty.call(row, col)) {
				updateValues[col] = row[col];
			}
		});
		await helpers.upsert(db, table, row, conflictColumns, updateValues, dialect);
	}
};

// =============================================================================
// DELETE HELPERS
// =============================================================================

/**
 * Delete from a table with key matching
 */
helpers.deleteByKey = async function (db, table, key) {
	await db.deleteFrom(table)
		.where('_key', '=', key)
		.execute();
};

/**
 * Delete from a table with multiple keys
 */
helpers.deleteByKeys = async function (db, table, keys) {
	if (!keys || !keys.length) return;

	await db.deleteFrom(table)
		.where('_key', 'in', keys)
		.execute();
};

// =============================================================================
// SORTED SET LEX HELPERS
// =============================================================================

/**
 * Parse lex range notation
 * - '-' means minimum (from beginning)
 * - '+' means maximum (to end)
 * - '[a' means >= 'a' (inclusive)
 * - '(a' means > 'a' (exclusive)
 * - 'a' (no prefix) defaults to inclusive
 */
helpers.parseLexRange = function (value) {
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
};

/**
 * Apply lex range conditions to a query
 * @param {object} query - Kysely query builder
 * @param {string} min - Minimum lex value
 * @param {string} max - Maximum lex value
 * @param {string} valueCol - Column name for the value (default: 'z.value')
 * @returns {object} Query builder with lex conditions applied
 */
helpers.applyLexConditions = function (query, min, max, valueCol = 'z.value') {
	const minParsed = helpers.parseLexRange(min);
	const maxParsed = helpers.parseLexRange(max);

	if (!minParsed.isMin) {
		const op = minParsed.inclusive ? '>=' : '>';
		query = query.where(valueCol, op, minParsed.value);
	}
	if (!maxParsed.isMax) {
		const op = maxParsed.inclusive ? '<=' : '<';
		query = query.where(valueCol, op, maxParsed.value);
	}
	return query;
};

// =============================================================================
// SORTED SET SCORE RANGE HELPERS
// =============================================================================

/**
 * Apply score range conditions to a query
 * @param {object} query - Kysely query builder
 * @param {string|number} min - Minimum score ('-inf' for no minimum)
 * @param {string|number} max - Maximum score ('+inf' for no maximum)
 * @param {string} scoreCol - Column name for the score (default: 'z.score')
 * @returns {object} Query builder with score conditions applied
 */
helpers.applyScoreConditions = function (query, min, max, scoreCol = 'z.score') {
	if (min !== '-inf') {
		query = query.where(scoreCol, '>=', parseFloat(min));
	}
	if (max !== '+inf') {
		query = query.where(scoreCol, '<=', parseFloat(max));
	}
	return query;
};

// =============================================================================
// PAGINATION HELPERS
// =============================================================================

/**
 * Apply offset and limit to a query, handling SQLite's requirement for LIMIT when using OFFSET
 * @param {object} query - Kysely query builder
 * @param {number} start - Start offset
 * @param {number} count - Number of items (-1 or undefined for no limit)
 * @returns {object} Query builder with pagination applied
 */
helpers.applyPagination = function (query, start, count) {
	if (start > 0 && count > 0) {
		query = query.offset(start).limit(count);
	} else if (start > 0) {
		// SQLite requires LIMIT when using OFFSET
		query = query.offset(start).limit(Number.MAX_SAFE_INTEGER);
	} else if (count > 0) {
		query = query.limit(count);
	}
	return query;
};

/**
 * Handle negative indices by fetching all results and slicing
 * @param {any[]} results - Array of results
 * @param {number} start - Start index (can be negative)
 * @param {number} stop - Stop index (can be negative, inclusive)
 * @returns {any[]} Sliced results
 */
helpers.sliceWithNegativeIndices = function (results, start, stop) {
	const len = results.length;
	if (len === 0) {
		return [];
	}

	// Convert negative indices to positive
	const startIdx = start < 0 ? Math.max(0, len + start) : start;
	const stopIdx = stop < 0 ? len + stop : stop;

	// Handle invalid ranges
	if (startIdx > stopIdx || startIdx >= len) {
		return [];
	}

	// Slice the results (stopIdx is inclusive, so +1)
	return results.slice(startIdx, stopIdx + 1);
};

// =============================================================================
// TRANSACTION HELPER
// =============================================================================

/**
 * Execute a function with a transaction, ensuring legacy object type
 * @param {object} module - Database module
 * @param {string} key - Key to ensure type for
 * @param {string} type - Object type (e.g., 'zset', 'hash')
 * @param {function} fn - Function to execute within transaction, receives (client, dialect)
 * @returns {any} Result of fn
 */
helpers.withTransaction = async function (module, key, type, fn) {
	const { dialect } = module;
	return await module.transaction(async (client) => {
		if (key) {
			await helpers.ensureLegacyObjectType(client, key, type, dialect);
		}
		return await fn(client, dialect);
	});
};

/**
 * Execute a function with a transaction, ensuring legacy object types for multiple keys
 * @param {object} module - Database module
 * @param {string[]} keys - Keys to ensure type for
 * @param {string} type - Object type (e.g., 'zset', 'hash')
 * @param {function} fn - Function to execute within transaction, receives (client, dialect)
 * @returns {any} Result of fn
 */
helpers.withTransactionKeys = async function (module, keys, type, fn) {
	const { dialect } = module;
	return await module.transaction(async (client) => {
		if (keys && keys.length) {
			await helpers.ensureLegacyObjectsType(client, keys, type, dialect);
		}
		return await fn(client, dialect);
	});
};