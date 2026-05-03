'use strict';

const fs = require('fs');
const path = require('path');
const nconf = require('nconf');
const winston = require('winston');

// PRAGMAs applied to every better-sqlite3 handle (writer + reader).
const SQLITE_PRAGMAS = [
	'busy_timeout = 30000', 'journal_mode = WAL', 'synchronous = NORMAL',
	'foreign_keys = ON', 'cache_size = -64000', 'mmap_size = 268435456',
	'temp_store = MEMORY', 'wal_autocheckpoint = 1000',
];

const conn = module.exports;

// Per-dialect: option defaults, kysely-dialect factory, post-connect ping.
const DEFAULTS = {
	mysql: { host: '127.0.0.1', port: 3306, user: '', password: '', database: 'nodebb', connectionLimit: 20, connectTimeout: 90000 },
	postgres: { host: '127.0.0.1', port: 5432, user: '', password: '', database: 'nodebb', max: 20, connectionTimeoutMillis: 90000 },
	sqlite: { filename: 'nodebb.db' },
	pglite: { dataDir: 'memory://' },
};

// PGlite is wire-compatible with PostgreSQL — same probe works.
const pgPing = db => db.selectFrom('pg_catalog.pg_tables').select('tablename').limit(1).execute();
const PING = {
	mysql: db => db.selectFrom('information_schema.tables').select('table_name').limit(1).execute(),
	postgres: pgPing,
	pglite: pgPing,
	sqlite: db => db.selectFrom('sqlite_master').select('name').limit(1).execute(),
};

conn.getDialect = options => (options || nconf.get('kysely') || {}).dialect || 'sqlite';

conn.getConnectionOptions = (options) => {
	options = options || nconf.get('kysely') || {};
	const dialect = conn.getDialect(options);
	const co = { dialect, ...DEFAULTS[dialect] };
	if (dialect === 'mysql' || dialect === 'postgres') {
		co.host = options.host || co.host;
		co.port = parseInt(options.port, 10) || co.port;
		co.user = options.username || options.user || co.user;
		co.password = options.password || co.password;
		co.database = options.database || co.database;
		if (dialect === 'mysql') {
			co.connectionLimit = options.connectionLimit || co.connectionLimit;
			co.connectTimeout = options.connectTimeout || co.connectTimeout;
		} else {
			co.max = options.max || co.max;
			co.connectionTimeoutMillis = options.connectionTimeoutMillis || co.connectionTimeoutMillis;
		}
		if (options.ssl) {
			if (dialect === 'mysql' || typeof options.ssl !== 'object') {
				co.ssl = typeof options.ssl === 'object' ? options.ssl : { rejectUnauthorized: false };
			} else {
				co.ssl = {
					rejectUnauthorized: options.ssl.rejectUnauthorized,
					...Object.fromEntries(['ca', 'key', 'cert']
						.filter(p => options.ssl[p])
						.map(p => [p, fs.readFileSync(options.ssl[p]).toString()])),
				};
			}
		}
	} else if (dialect === 'sqlite') {
		co.filename = options.filename || options.database || co.filename;
	} else if (dialect === 'pglite') {
		// `memory://` (in-memory) or a filesystem path for persistent storage.
		co.dataDir = options.dataDir || options.database || co.dataDir;
	} else {
		Object.assign(co, options);
	}
	return co;
};

const MAKE = {
	async mysql(co) {
		const { MysqlDialect } = require('kysely');
		const mysql2 = require('mysql2');
		const pool = mysql2.createPool({
			host: co.host, port: co.port, user: co.user, password: co.password,
			database: co.database, connectionLimit: co.connectionLimit,
			connectTimeout: co.connectTimeout, ssl: co.ssl,
			// Force UTC for DATETIME serialization. mysql2 defaults to the
			// process-local timezone, which silently warps `legacy_object.expireAt`
			// across a UTC-MySQL ↔ non-UTC client boundary (every TTL call
			// drifts by the offset). 'Z' makes the driver send/parse DATETIME
			// values verbatim in UTC.
			timezone: 'Z',
		});
		// kysely's MysqlDialect uses the callback-style `pool.getConnection(cb)`
		// API; pass the raw mysql2 pool, NOT `pool.promise()` (which would
		// return a Promise from getConnection and silently hang the driver).
		return new MysqlDialect({ pool });
	},
	async postgres(co) {
		const { PostgresDialect } = require('kysely');
		const { Pool } = require('pg');
		return new PostgresDialect({
			pool: new Pool({
				host: co.host, port: co.port, user: co.user, password: co.password,
				database: co.database, max: co.max,
				connectionTimeoutMillis: co.connectionTimeoutMillis, ssl: co.ssl,
			}),
		});
	},
	async sqlite(co) {
		if (co.filename !== ':memory:') {
			const dir = path.dirname(co.filename);
			if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
		}
		// Worker-thread dialect: synchronous better-sqlite3 I/O runs off-main,
		// so SQLite behaves like the network-async dialects (pg/mysql) from
		// the main event loop's perspective.
		const { WorkerSqliteDialect } = require('./dialect-better-sqlite-worker');
		return new WorkerSqliteDialect({ filename: co.filename, pragmas: SQLITE_PRAGMAS });
	},
	async pglite(co) {
		// PGlite — embedded WASM PostgreSQL. Wire-compatible with pg, but
		// runs in-process (or in a worker via the `worker:` data-dir prefix).
		// Useful as a Postgres-syntax alternative to SQLite without standing
		// up a network database.
		const { PGlite } = require('@electric-sql/pglite');
		const { PGliteDialect } = require('kysely-pglite-dialect');
		if (co.dataDir && co.dataDir !== 'memory://' && !co.dataDir.includes('://')) {
			fs.mkdirSync(co.dataDir, { recursive: true });
		}
		return new PGliteDialect(new PGlite(co.dataDir));
	},
};

const sqlLog = (event) => {
	if (process.env.LOG_SQL !== 'true') return;
	const out = event.level === 'error' ? console.error : console.log;
	const tag = event.level === 'error' ? 'Query failed: ' : 'Query executed: ';
	const payload = {
		durationMs: event.queryDurationMillis,
		sql: event.query.sql,
		params: event.query.parameters,
	};
	if (event.error) payload.error = event.error;
	out(tag, payload);
};

conn.createKyselyInstance = async (options) => {
	const { Kysely } = require('kysely');
	const co = conn.getConnectionOptions(options);
	const make = MAKE[co.dialect];
	let kyselyDialect;
	if (make) {
		kyselyDialect = await make(co);
	} else if (co.kyselyDialect) {
		winston.warn(`[database/kysely] Dialect "${co.dialect}" is not officially supported.`);
		kyselyDialect = typeof co.kyselyDialect === 'function' ?
			co.kyselyDialect(co) :
			new (require(co.kyselyDialect))(co);
	} else {
		throw new Error(`Unsupported database dialect: ${co.dialect}. Provide a "kyselyDialect" in your config (function or package name) to use a custom dialect.`);
	}
	const db = new Kysely({ dialect: kyselyDialect, log: sqlLog });
	try {
		const ping = PING[co.dialect];
		if (ping) await ping(db);
	} catch (err) {
		winston.error(`Failed to connect to database: ${err.message}`);
		throw err;
	}
	return db;
};

conn.connect = options => conn.createKyselyInstance(options);

require('../../promisify')(conn);
