'use strict';

const { sql } = require('kysely');

const features = module.exports;

// Test table name for feature detection
const TEST_TABLE = '__kysely_feature_test__';

// =============================================================================
// FEATURE DETECTION
// =============================================================================

/**
 * Detect database feature support at runtime.
 * Uses temp tables and dialect-specific queries to avoid dependencies.
 * @param {object} db - Kysely database instance
 * @param {string} dialect - Database dialect (hint, can be overridden by detection)
 * @returns {Promise<object>} Feature detection results
 */
features.detect = async function (db, dialect) {
	const result = {
		// Upsert strategies
		onConflict: false, // PostgreSQL, SQLite: ON CONFLICT ... DO UPDATE
		onDuplicateKey: false, // MySQL: ON DUPLICATE KEY UPDATE
		merge: false, // MSSQL, Oracle: MERGE statement

		// Pagination strategies
		limitOffset: false, // MySQL, PostgreSQL, SQLite: LIMIT x OFFSET y
		offsetFetch: false, // MSSQL 2012+, Oracle 12c+: OFFSET x ROWS FETCH NEXT y ROWS ONLY

		// Query features
		cte: false, // WITH clause (Common Table Expressions)
		selectNoFrom: false, // SELECT 1 without FROM
		dual: false, // DUAL table (Oracle, MySQL)

		// Locking
		locking: false, // FOR UPDATE support

		// Dialect-specific functions
		sqliteVersion: false, // sqlite_version() function
		mysqlVersion: false, // VERSION() function
		pgVersion: false, // version() function

		// Detected dialect (guessed from features)
		detectedDialect: null,

		// Timestamps
		timestampType: 'text', // Default to text (safest)
	};

	// First, run dialect-specific detection (these don't need tables)
	await detectDialectHints(db, result);

	// Create temp test table for upsert detection
	const testTableCreated = await createTestTable(db);

	if (testTableCreated) {
		try {
			// Detect upsert support using test table
			result.onConflict = await testOnConflict(db);
			result.onDuplicateKey = await testOnDuplicateKey(db);
			result.merge = await testMerge(db);

			// Detect pagination with test table
			result.limitOffset = await testLimitOffset(db);
			result.offsetFetch = await testOffsetFetch(db);

			// Detect CTE with test table
			result.cte = await testCTE(db);

			// Detect locking with test table
			result.locking = await testLocking(db);
		} finally {
			// Clean up test table
			await dropTestTable(db);
		}
	}

	// Final dialect guess from all detected features
	result.detectedDialect = features.guessDialect(result);

	// Use detected dialect if available, otherwise use hint
	const effectiveDialect = result.detectedDialect || dialect;
	result.timestampType = features.getTimestampType(effectiveDialect);

	return result;
};

/**
 * Detect dialect hints using queries that don't require tables.
 * These help identify the database before creating test tables.
 */
async function detectDialectHints(db, result) {
	// Test SELECT without FROM (works in most DBs except Oracle)
	result.selectNoFrom = await testSelectNoFrom(db);

	// Test DUAL table (Oracle, MySQL support it)
	result.dual = await testDual(db);

	// Test dialect-specific version functions
	result.sqliteVersion = await testSqliteVersion(db);
	result.mysqlVersion = await testMysqlVersion(db);
	result.pgVersion = await testPostgresVersion(db);

	// Set initial dialect guess based on version functions
	if (result.sqliteVersion) {
		result.detectedDialect = 'sqlite';
	} else if (result.pgVersion) {
		result.detectedDialect = 'postgres';
	} else if (result.mysqlVersion) {
		result.detectedDialect = 'mysql';
	} else if (result.dual && !result.selectNoFrom) {
		// Oracle requires DUAL for SELECT without table
		result.detectedDialect = 'oracle';
	}
}

/**
 * Create temporary test table for feature detection.
 */
async function createTestTable(db) {
	try {
		await db.schema
			.createTable(TEST_TABLE)
			.ifNotExists()
			.addColumn('id', 'varchar(100)', col => col.primaryKey().notNull())
			.addColumn('val', 'varchar(100)')
			.execute();
		return true;
	} catch {
		return false;
	}
}

/**
 * Drop the test table.
 */
async function dropTestTable(db) {
	try {
		await db.schema.dropTable(TEST_TABLE).ifExists().execute();
	} catch {
		// Ignore errors during cleanup
	}
}

/**
 * Guess the SQL dialect based on detected features.
 * Uses multiple signals for more accurate detection.
 */
features.guessDialect = function (detected) {
	// SQLite: sqlite_version works, no locking
	if (detected.sqliteVersion) {
		return 'sqlite';
	}

	// PostgreSQL: version() works, has locking, ON CONFLICT works
	if (detected.pgVersion) {
		return 'postgres';
	}

	// MySQL: VERSION() works, ON DUPLICATE KEY works
	if (detected.mysqlVersion || detected.onDuplicateKey) {
		return 'mysql';
	}

	// Oracle: DUAL required (no SELECT without FROM), MERGE works
	if (detected.dual && !detected.selectNoFrom && detected.merge) {
		return 'oracle';
	}

	// MSSQL: MERGE + OFFSET FETCH, SELECT without FROM works
	if (detected.merge && detected.offsetFetch && detected.selectNoFrom) {
		return 'mssql';
	}

	// Fallback heuristics using upsert detection
	if (detected.onConflict && detected.locking) {
		return 'postgres';
	}
	if (detected.onConflict && !detected.locking) {
		return 'sqlite';
	}
	if (detected.onDuplicateKey) {
		return 'mysql';
	}
	if (detected.merge) {
		return detected.offsetFetch ? 'mssql' : 'oracle';
	}

	return null;
};

/**
 * Get the appropriate timestamp type for a dialect.
 */
features.getTimestampType = function (dialect) {
	const typeMap = {
		sqlite: 'text',
		postgres: 'timestamptz',
		mysql: 'timestamp',
		mssql: 'datetime2',
		oracle: 'timestamp with time zone',
	};
	return typeMap[dialect] || 'text';
};

// =============================================================================
// DIALECT HINT TESTS (no table required)
// =============================================================================

async function testSelectNoFrom(db) {
	try {
		// SELECT 1 without FROM - works in MySQL, PostgreSQL, SQLite, MSSQL
		// Oracle requires "FROM DUAL"
		await sql`SELECT 1`.execute(db);
		return true;
	} catch {
		return false;
	}
}

async function testDual(db) {
	try {
		// SELECT FROM DUAL - works in Oracle, MySQL
		await sql`SELECT 1 FROM DUAL`.execute(db);
		return true;
	} catch {
		return false;
	}
}

async function testSqliteVersion(db) {
	try {
		const result = await sql`SELECT sqlite_version()`.execute(db);
		return result.rows && result.rows.length > 0;
	} catch {
		return false;
	}
}

async function testMysqlVersion(db) {
	try {
		// MySQL-specific VERSION() function
		const result = await sql`SELECT VERSION()`.execute(db);
		return result.rows && result.rows.length > 0;
	} catch {
		return false;
	}
}

async function testPostgresVersion(db) {
	try {
		// PostgreSQL-specific version() function
		const result = await sql`SELECT version()`.execute(db);
		// PostgreSQL version string starts with "PostgreSQL"
		if (result.rows && result.rows.length > 0) {
			const version = Object.values(result.rows[0])[0];
			return typeof version === 'string' && version.toLowerCase().includes('postgresql');
		}
		return false;
	} catch {
		return false;
	}
}

// =============================================================================
// FEATURE TEST FUNCTIONS (use test table)
// =============================================================================

async function testOnConflict(db) {
	try {
		// Try PostgreSQL/SQLite ON CONFLICT syntax
		await db.insertInto(TEST_TABLE)
			.values({ id: '__test__', val: 'test' })
			.onConflict(oc => oc.columns(['id']).doNothing())
			.execute();
		await db.deleteFrom(TEST_TABLE).where('id', '=', '__test__').execute();
		return true;
	} catch {
		return false;
	}
}

async function testOnDuplicateKey(db) {
	try {
		// Try MySQL ON DUPLICATE KEY UPDATE syntax
		await db.insertInto(TEST_TABLE)
			.values({ id: '__test__', val: 'test' })
			.onDuplicateKeyUpdate({ val: 'test' })
			.execute();
		await db.deleteFrom(TEST_TABLE).where('id', '=', '__test__').execute();
		return true;
	} catch {
		return false;
	}
}

async function testMerge(db) {
	try {
		// Try MERGE statement using Kysely's mergeInto() (MSSQL, Oracle)
		await db.mergeInto(`${TEST_TABLE} as target`)
			.using(
				db.selectNoFrom(eb => [
					eb.val('__test__').as('id'),
					eb.val('test').as('val'),
				]).as('source'),
				join => join.onRef('target.id', '=', 'source.id')
			)
			.whenMatched()
			.thenUpdateSet({ val: eb => eb.ref('source.val') })
			.whenNotMatched()
			.thenInsertValues({
				id: eb => eb.ref('source.id'),
				val: eb => eb.ref('source.val'),
			})
			.execute();
		await db.deleteFrom(TEST_TABLE).where('id', '=', '__test__').execute();
		return true;
	} catch {
		return false;
	}
}

async function testLimitOffset(db) {
	try {
		await db.selectFrom(TEST_TABLE)
			.select('id')
			.limit(1)
			.offset(0)
			.execute();
		return true;
	} catch {
		return false;
	}
}

async function testOffsetFetch(db) {
	try {
		// Try OFFSET FETCH syntax (MSSQL 2012+, Oracle 12c+)
		await sql`
			SELECT id FROM ${sql.table(TEST_TABLE)}
			ORDER BY id
			OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY
		`.execute(db);
		return true;
	} catch {
		return false;
	}
}

async function testCTE(db) {
	try {
		// Test CTE (WITH clause) support
		await db.with('cte', qb => qb.selectFrom(TEST_TABLE).select('id').limit(1))
			.selectFrom('cte')
			.select('id')
			.execute();
		return true;
	} catch {
		return false;
	}
}

async function testLocking(db) {
	try {
		await db.transaction().execute(async (trx) => {
			await trx.selectFrom(TEST_TABLE)
				.select('id')
				.limit(1)
				.forUpdate()
				.execute();
		});
		return true;
	} catch {
		return false;
	}
}