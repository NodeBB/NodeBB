'use strict';

const nconf = require('nconf');
const winston = require('winston');

const connection = module.exports;

connection.getDialect = function (options) {
	options = options || nconf.get('kysely') || {};
	return options.dialect || 'sqlite';
};

connection.getConnectionOptions = function (options) {
	options = options || nconf.get('kysely') || {};
	const dialect = connection.getDialect(options);

	const connOptions = {
		dialect: dialect,
	};

	if (dialect === 'mysql') {
		// MySQL connection options
		connOptions.host = options.host || '127.0.0.1';
		connOptions.port = parseInt(options.port, 10) || 3306;
		connOptions.user = options.username || options.user || '';
		connOptions.password = options.password || '';
		connOptions.database = options.database || 'nodebb';
		connOptions.connectionLimit = options.connectionLimit || 20;
		connOptions.connectTimeout = options.connectTimeout || 90000;

		if (options.ssl) {
			connOptions.ssl = typeof options.ssl === 'object' ? options.ssl : { rejectUnauthorized: false };
		}
	} else if (dialect === 'postgres') {
		// PostgreSQL connection options
		connOptions.host = options.host || '127.0.0.1';
		connOptions.port = parseInt(options.port, 10) || 5432;
		connOptions.user = options.username || options.user || '';
		connOptions.password = options.password || '';
		connOptions.database = options.database || 'nodebb';
		connOptions.max = options.max || 20;
		connOptions.connectionTimeoutMillis = options.connectionTimeoutMillis || 90000;

		if (options.ssl) {
			const fs = require('fs');
			if (typeof options.ssl === 'object') {
				connOptions.ssl = {
					rejectUnauthorized: options.ssl.rejectUnauthorized,
					...Object.fromEntries(
						['ca', 'key', 'cert']
							.filter(prop => options.ssl[prop])
							.map(prop => [prop, fs.readFileSync(options.ssl[prop]).toString()])
					),
				};
			} else {
				connOptions.ssl = { rejectUnauthorized: false };
			}
		}
	} else if (dialect === 'sqlite') {
		// SQLite connection options
		connOptions.filename = options.filename || options.database || 'nodebb.db';
	} else if (dialect === 'pglite') {
		// PGlite connection options (embedded PostgreSQL)
		// Use :memory: for in-memory database or a path for persistent storage
		connOptions.dataDir = options.dataDir || options.database || 'memory://';
	} else {
		// Unknown dialect - pass through all options for custom dialects
		Object.assign(connOptions, options);
	}

	return connOptions;
};

connection.createKyselyInstance = async function (options) {
	const { Kysely, MysqlDialect, PostgresDialect, SqliteDialect } = require('kysely');

	const connOptions = connection.getConnectionOptions(options);
	const { dialect } = connOptions;

	let kyselyDialect;

	if (dialect === 'mysql') {
		const mysql2 = require('mysql2');
		const pool = mysql2.createPool({
			host: connOptions.host,
			port: connOptions.port,
			user: connOptions.user,
			password: connOptions.password,
			database: connOptions.database,
			connectionLimit: connOptions.connectionLimit,
			connectTimeout: connOptions.connectTimeout,
			ssl: connOptions.ssl,
		});

		kyselyDialect = new MysqlDialect({
			pool: pool.promise(),
		});
	} else if (dialect === 'postgres') {
		const { Pool } = require('pg');
		const pool = new Pool({
			host: connOptions.host,
			port: connOptions.port,
			user: connOptions.user,
			password: connOptions.password,
			database: connOptions.database,
			max: connOptions.max,
			connectionTimeoutMillis: connOptions.connectionTimeoutMillis,
			ssl: connOptions.ssl,
		});

		kyselyDialect = new PostgresDialect({
			pool: pool,
		});
	} else if (dialect === 'sqlite') {
		const Database = require('better-sqlite3');
		const path = require('path');
		const fs = require('fs');

		// Auto-create directory if it doesn't exist (for file-based databases)
		if (connOptions.filename !== ':memory:') {
			const dir = path.dirname(connOptions.filename);
			if (dir && dir !== '.') {
				fs.mkdirSync(dir, { recursive: true });
			}
		}

		const database = new Database(connOptions.filename);
		database.pragma('journal_mode = WAL');
		database.pragma('foreign_keys = ON');
		database.pragma('busy_timeout = 30000'); // Wait up to 30 seconds for lock to release

		kyselyDialect = new SqliteDialect({
			database: database,
		});
	} else if (dialect === 'pglite') {
		const { PGlite } = require('@electric-sql/pglite');
		const { PGliteDialect } = require('kysely-pglite-dialect');

		const pglite = new PGlite(connOptions.dataDir);

		kyselyDialect = new PGliteDialect(pglite);
	} else {
		// Unsupported dialect - warn and attempt to use custom dialect from options
		winston.warn(`[database/kysely] Dialect "${dialect}" is not officially supported.`);
		winston.warn('[database/kysely] Attempting to use custom dialect configuration from options.');

		if (connOptions.kyselyDialect) {
			if (typeof connOptions.kyselyDialect === 'function') {
				// User provided a factory function
				kyselyDialect = connOptions.kyselyDialect(connOptions);
			} else {
				// User provided a package name to require
				const CustomDialect = require(connOptions.kyselyDialect);
				kyselyDialect = new CustomDialect(connOptions);
			}
		} else {
			throw new Error(
				`Unsupported database dialect: ${dialect}. ` +
				'Provide a "kyselyDialect" in your config (function or package name) to use a custom dialect.'
			);
		}
	}

	const db = new Kysely({
		dialect: kyselyDialect,
		log(event) {
			if (process.env.LOG_SQL !== 'true') return;
			if (event.level === 'error') {
				console.error('Query failed : ', {
					durationMs: event.queryDurationMillis,
					error: event.error,
					sql: event.query.sql,
					params: event.query.parameters,
				});
			} else { // `'query'`
				console.log('Query executed : ', {
					durationMs: event.queryDurationMillis,
					sql: event.query.sql,
					params: event.query.parameters,
				});
			}
		},
	});

	// Test the connection
	try {
		if (dialect === 'mysql') {
			await db.selectFrom('information_schema.tables').select('table_name').limit(1).execute();
		} else if (dialect === 'postgres' || dialect === 'pglite') {
			await db.selectFrom('pg_catalog.pg_tables').select('tablename').limit(1).execute();
		} else if (dialect === 'sqlite') {
			await db.selectFrom('sqlite_master').select('name').limit(1).execute();
		}
	} catch (err) {
		winston.error(`Failed to connect to database: ${err.message}`);
		throw err;
	}

	return db;
};

connection.connect = async function (options) {
	return await connection.createKyselyInstance(options);
};

require('../../promisify')(connection);