'use strict';

/**
 * better-sqlite3 worker thread.
 *
 * Owns one writer + one reader Database instance against a shared WAL-mode
 * file. Receives query/transaction commands from the parent thread on a
 * MessageChannel and replies asynchronously. Each connection on the parent
 * side has a stable `connId` so that BEGIN/COMMIT/ROLLBACK on writer #N
 * remain associated.
 *
 * Why a worker?
 *   better-sqlite3 is synchronous: every C++ call blocks the V8 main thread
 *   for the duration of the SQLite call. NodeBB's test suite issues many
 *   concurrent HTTP handlers; on the main thread, even a 50 ms write blocks
 *   every other HTTP response, setImmediate callback, and timer that should
 *   have fired in that window. Moving better-sqlite3 to a worker keeps the
 *   main loop free and matches the async behaviour of the network-backed
 *   dialects (Postgres, MySQL).
 */

const { parentPort, workerData } = require('worker_threads');
const Database = require('better-sqlite3');

const { filename, pragmas } = workerData;

const writer = new Database(filename);
const reader = new Database(filename);
for (const p of pragmas) {
	writer.pragma(p);
	reader.pragma(p);
}

/**
 * Per-connection prepared-statement cache. better-sqlite3 does not cache
 * `prepare()` internally; the parent-side dialect previously kept its own
 * cache. Caching on the worker is identical in semantics and avoids the
 * extra round-trip of "compile in worker" → "send id back" coordination.
 */
class StatementCache {
	constructor(db, maxEntries = 512) {
		this.db = db;
		this.max = maxEntries;
		this.map = new Map();
	}

	get(sql) {
		const cached = this.map.get(sql);
		if (cached) {
			this.map.delete(sql);
			this.map.set(sql, cached);
			return cached;
		}
		const stmt = this.db.prepare(sql);
		this.map.set(sql, stmt);
		if (this.map.size > this.max) {
			const oldest = this.map.keys().next().value;
			this.map.delete(oldest);
		}
		return stmt;
	}
}

const writerCache = new StatementCache(writer);
const readerCache = new StatementCache(reader);

/**
 * Encode a better-sqlite3 result for the structured-clone post message.
 * BigInt → string (because BigInts are clonable in newer Node but kysely
 * later JSON.stringifies them in some places); Buffer → ArrayBuffer.
 */
function serialiseValue(v) {
	if (typeof v === 'bigint') return v.toString();
	if (v && typeof v === 'object' && Buffer.isBuffer(v)) return new Uint8Array(v);
	return v;
}

function serialiseRow(row) {
	const out = {};
	for (const k of Object.keys(row)) out[k] = serialiseValue(row[k]);
	return out;
}

function executeOne(target, cache, sql, params) {
	const stmt = cache.get(sql);
	stmt.safeIntegers(false);
	if (stmt.reader) {
		const rows = stmt.all(params || []);
		return { rows: rows.map(serialiseRow) };
	}
	const info = stmt.run(params || []);
	return {
		rows: [],
		numAffectedRows: info.changes !== undefined && info.changes !== null ?
			BigInt(info.changes).toString() : undefined,
		insertId: info.lastInsertRowid !== undefined && info.lastInsertRowid !== null ?
			BigInt(info.lastInsertRowid).toString() : undefined,
	};
}

parentPort.on('message', (msg) => {
	const { id, op } = msg;
	try {
		if (op === 'begin') {
			writer.prepare('BEGIN IMMEDIATE').run();
			parentPort.postMessage({ id, ok: true });
		} else if (op === 'commit') {
			writer.prepare('COMMIT').run();
			parentPort.postMessage({ id, ok: true });
		} else if (op === 'rollback') {
			try { writer.prepare('ROLLBACK').run(); } catch (_) { /* implicit rollback already happened */ }
			parentPort.postMessage({ id, ok: true });
		} else if (op === 'query') {
			const { sql, params, target } = msg;
			const t = target === 'writer' ? writer : reader;
			const cache = target === 'writer' ? writerCache : readerCache;
			const result = executeOne(t, cache, sql, params);
			parentPort.postMessage({ id, ok: true, result });
		} else {
			parentPort.postMessage({ id, ok: false, err: { message: `unknown op: ${op}` } });
		}
	} catch (err) {
		parentPort.postMessage({
			id,
			ok: false,
			err: { message: err.message, code: err.code, stack: err.stack },
		});
	}
});

parentPort.postMessage({ ready: true });
