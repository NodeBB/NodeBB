'use strict';

const helpers = module.exports;

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
			if (row.hasOwnProperty(col)) {
				updateValues[col] = row[col];
			}
		});
		await helpers.upsert(db, table, row, conflictColumns, updateValues, dialect);
	}
};

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