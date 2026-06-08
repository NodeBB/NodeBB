'use strict';

/**
 * Worker-thread better-sqlite3 dialect for Kysely.
 *
 * Why a worker thread (and why WAL alone is insufficient):
 *
 *   better-sqlite3 is a SYNCHRONOUS C++ binding. Every `.run()` / `.all()`
 *   blocks the V8 main thread for the entire duration of the SQLite call,
 *   including any disk I/O, fsync, and mutex contention inside SQLite.
 *   While that call is in-flight, libuv cannot run setImmediate/setTimeout
 *   callbacks, cannot service socket reads, and cannot flush HTTP responses.
 *
 *   WAL mode lets one writer and many readers coexist on the *file*; it does
 *   nothing about the fact that a single Node process executing better-sqlite3
 *   on the main thread can only have one syscall outstanding at a time. WAL
 *   is a concurrency-protocol feature; the main loop blockage is an
 *   execution-model problem. The two are orthogonal.
 *
 *   Networked drivers (pg, mysql2) sidestep this by issuing async socket I/O:
 *   they hand bytes to libuv and yield. To match that semantics for SQLite we
 *   move all better-sqlite3 calls onto a `worker_threads` Worker. The parent
 *   thread sees Promise-resolving postMessage replies — the same shape as a
 *   pg query — and the main loop is never blocked by SQLite I/O.
 *
 * Concurrency model (mirrors a pg/mysql connection pool):
 *
 *   - One Worker, one writer Database, one reader Database — all sharing a
 *     single SQLite WAL file. WAL ensures the reader doesn't block the writer.
 *   - Each call to `acquireConnection` hands back a *fresh* logical
 *     connection object with its own transaction-state flag. Concurrent
 *     transactions therefore cannot corrupt each other's `_inTx` state.
 *   - A single FIFO mutex serialises writers across logical connections.
 *     Held briefly for ad-hoc writes, held for the duration of a transaction.
 *   - Reads (outside a tx) skip the mutex entirely and pipeline through the
 *     reader connection — true async parallelism from the parent's view,
 *     just like a pg pool.
 */

const path = require('path');
const { Worker } = require('worker_threads');
const {
	SelectQueryNode,
	SqliteQueryCompiler,
	SqliteAdapter,
	SqliteIntrospector,
} = require('kysely');

const READ_SQL_PREFIX = /^\s*(?:WITH\s+RECURSIVE\b|WITH\b|SELECT\b|EXPLAIN\b)/i;

const READ_PRAGMA_NAMES = new Set([
	'application_id', 'auto_vacuum', 'busy_timeout', 'cache_size', 'cache_spill',
	'cell_size_check', 'checkpoint_fullfsync', 'collation_list', 'compile_options',
	'data_version', 'database_list', 'defer_foreign_keys', 'encoding', 'foreign_keys',
	'foreign_key_check', 'foreign_key_list', 'freelist_count', 'fullfsync',
	'function_list', 'hard_heap_limit', 'ignore_check_constraints', 'index_info',
	'index_list', 'index_xinfo', 'integrity_check', 'journal_mode', 'journal_size_limit',
	'legacy_alter_table', 'legacy_file_format', 'locking_mode', 'max_page_count',
	'mmap_size', 'module_list', 'page_count', 'page_size', 'parser_trace',
	'pragma_list', 'query_only', 'quick_check', 'read_uncommitted', 'recursive_triggers',
	'reverse_unordered_selects', 'schema_version',
	'secure_delete', 'soft_heap_limit', 'stats', 'synchronous',
	'table_info', 'table_list', 'table_xinfo', 'temp_store',
	'temp_store_directory', 'threads', 'trusted_schema', 'user_version',
	'wal_autocheckpoint',
]);

function isReadOnlyPragma(sql) {
	const m = sql.match(/^\s*PRAGMA\s+([A-Za-z_][A-Za-z0-9_]*)/i);
	return m ? READ_PRAGMA_NAMES.has(m[1].toLowerCase()) : false;
}

function isReadOnly(compiledQuery) {
	const node = compiledQuery && compiledQuery.query;
	if (!node) return false;
	if (SelectQueryNode.is(node)) return true;
	if (node.kind === 'RawNode') {
		const sql = compiledQuery.sql || '';
		if (/^\s*PRAGMA\b/i.test(sql)) return isReadOnlyPragma(sql);
		return READ_SQL_PREFIX.test(sql);
	}
	return false;
}

/** FIFO promise-chain mutex. */
class WriterMutex {
	constructor() { this._tail = Promise.resolve(); }
	acquire() {
		let release;
		const next = new Promise((resolve) => { release = resolve; });
		const prior = this._tail;
		this._tail = next;
		return prior.then(() => release);
	}
}

/**
 * Promise-correlated RPC over a single Worker. Every postMessage carries a
 * monotonically-increasing id; the worker echoes the id on reply so multiple
 * logical connections can pipeline through the same Worker concurrently.
 */
class WorkerRpc {
	constructor(worker) {
		this._worker = worker;
		this._nextId = 1;
		this._pending = new Map();
		worker.on('message', (msg) => {
			if (!msg || typeof msg.id !== 'number') return;
			const cb = this._pending.get(msg.id);
			if (cb) {
				this._pending.delete(msg.id);
				cb(msg);
			}
		});
		worker.on('error', (err) => {
			for (const cb of this._pending.values()) {
				cb({ ok: false, err: { message: `worker error: ${err.message}` } });
			}
			this._pending.clear();
		});
	}
	send(payload) {
		const id = this._nextId;
		this._nextId += 1;
		return new Promise((resolve, reject) => {
			this._pending.set(id, (msg) => {
				if (msg.ok) {
					resolve(msg.result);
				} else {
					const err = new Error((msg.err && msg.err.message) || 'worker query failed');
					if (msg.err && msg.err.code) err.code = msg.err.code;
					reject(err);
				}
			});
			this._worker.postMessage({ id, ...payload });
		});
	}
}

/**
 * One *logical* SQLite connection. The Worker + writer mutex are shared
 * across every connection in the dialect; each instance only owns its own
 * transaction state, which matches how pg pool connections behave.
 */
class WorkerSqliteConnection {
	constructor({ rpc, writerMutex }) {
		this._rpc = rpc;
		this._writerMutex = writerMutex;
		this._inTx = false;
		this._releaseMutex = null;
	}

	async beginTx() {
		this._releaseMutex = await this._writerMutex.acquire();
		try {
			await this._rpc.send({ op: 'begin' });
			this._inTx = true;
		} catch (err) {
			const r = this._releaseMutex;
			this._releaseMutex = null;
			r();
			throw err;
		}
	}

	async commitTx() {
		try {
			await this._rpc.send({ op: 'commit' });
		} finally {
			this._inTx = false;
			const r = this._releaseMutex;
			this._releaseMutex = null;
			if (r) r();
		}
	}

	async rollbackTx() {
		try {
			await this._rpc.send({ op: 'rollback' });
		} catch (_) {
			// implicit rollback may have already happened
		} finally {
			this._inTx = false;
			const r = this._releaseMutex;
			this._releaseMutex = null;
			if (r) r();
		}
	}

	async executeQuery(compiledQuery) {
		// In-tx: every query (read or write) must hit the writer so it sees
		// its own uncommitted state.
		if (this._inTx) {
			return this._normalise(await this._rpc.send({
				op: 'query', target: 'writer',
				sql: compiledQuery.sql, params: compiledQuery.parameters,
			}));
		}
		// Outside a tx: reads pipeline freely through the reader connection
		// (WAL gives us the snapshot, the worker gives us async concurrency).
		if (isReadOnly(compiledQuery)) {
			return this._normalise(await this._rpc.send({
				op: 'query', target: 'reader',
				sql: compiledQuery.sql, params: compiledQuery.parameters,
			}));
		}
		// Standalone write — hold the writer mutex only for this statement.
		const release = await this._writerMutex.acquire();
		try {
			return this._normalise(await this._rpc.send({
				op: 'query', target: 'writer',
				sql: compiledQuery.sql, params: compiledQuery.parameters,
			}));
		} finally {
			release();
		}
	}

	_normalise(result) {
		const out = { rows: result.rows || [] };
		if (result.numAffectedRows !== undefined && result.numAffectedRows !== null) {
			out.numAffectedRows = BigInt(result.numAffectedRows);
		}
		if (result.insertId !== undefined && result.insertId !== null) {
			out.insertId = BigInt(result.insertId);
		}
		return out;
	}

	// eslint-disable-next-line require-yield
	async * streamQuery() {
		throw new Error('streamQuery not supported in worker dialect');
	}
}

class WorkerSqliteDriver {
	constructor(config) {
		this._config = config;
		this._writerMutex = new WriterMutex();
	}

	async init() {
		this._worker = new Worker(path.join(__dirname, 'sqlite-worker.js'), {
			workerData: { filename: this._config.filename, pragmas: this._config.pragmas || [] },
		});
		this._rpc = new WorkerRpc(this._worker);
		await new Promise((resolve, reject) => {
			const handlers = {};
			handlers.onError = (err) => {
				this._worker.off('message', handlers.onReady);
				reject(err);
			};
			handlers.onReady = (msg) => {
				if (msg && msg.ready) {
					this._worker.off('error', handlers.onError);
					resolve();
				}
			};
			this._worker.once('message', handlers.onReady);
			this._worker.once('error', handlers.onError);
		});
	}

	async acquireConnection() {
		// Fresh logical connection per acquire — matches pool semantics so
		// concurrent transactions don't share `_inTx` state.
		return new WorkerSqliteConnection({ rpc: this._rpc, writerMutex: this._writerMutex });
	}

	async releaseConnection() {
		// Logical connection is GC'd by Kysely; nothing to release on the
		// worker side — the underlying writer/reader handles outlive every
		// logical connection for the lifetime of the driver.
	}

	async beginTransaction(connection) { await connection.beginTx(); }
	async commitTransaction(connection) { await connection.commitTx(); }
	async rollbackTransaction(connection) { await connection.rollbackTx(); }

	async destroy() {
		if (this._worker) {
			await this._worker.terminate();
			this._worker = null;
		}
	}
}

class WorkerSqliteDialect {
	constructor(config) { this._config = config; }
	createDriver() { return new WorkerSqliteDriver(this._config); }
	createQueryCompiler() { return new SqliteQueryCompiler(); }
	createAdapter() { return new SqliteAdapter(); }
	createIntrospector(db) { return new SqliteIntrospector(db); }
}

module.exports = {
	WorkerSqliteDialect,
	WorkerSqliteDriver,
	WorkerSqliteConnection,
	isReadOnly,
};
