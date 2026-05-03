'use strict';

/**
 * dbsearch / kysely adapter (NodeBB-side patch).
 *
 * Built on Kysely's query builder + schema builder. Raw SQL is reserved for
 * the four constructs Kysely cannot model:
 *   - SQLite FTS5 virtual-table creation (`CREATE VIRTUAL TABLE … USING fts5(...)`)
 *     — column-list syntax is FTS-specific (no types, `UNINDEXED`).
 *   - MySQL `FULLTEXT INDEX` declaration — no schema-builder API.
 *   - Postgres `to_tsvector(...) @@ plainto_tsquery(...)` predicates and
 *     `ts_rank_cd(...)` ordering — readable as a single SQL fragment;
 *     unrolling into `eb.fn` + `eb.cast` makes the intent harder to see.
 *   - MySQL `MATCH(col) AGAINST(query IN BOOLEAN MODE)` — special-case syntax.
 * Everything else flows through `selectFrom`, `insertInto`, `deleteFrom`,
 * `replaceInto`, `onConflict`, `db.schema.createTable`, `db.schema.createIndex`,
 * `eb.fn`, `eb.ref`, etc.
 */

const winston = require.main.require('winston');
const nconf = require.main.require('nconf');
const db = require.main.require('./src/database');
const pubsub = require.main.require('./src/pubsub');
const { sql } = require('kysely');

let searchLanguage = 'english';

pubsub.on('dbsearch-language-changed', (e) => {
	searchLanguage = e.data;
});

const PG_DIALECTS = new Set(['postgres', 'pglite']);

function getDialect() { return db.dialect || db.originalDialect || 'sqlite'; }
function isPgFamily(dialect) { return PG_DIALECTS.has(dialect); }
function getHandle() { return db.client || db.db || db.pool; }
function otherColFor(table) { return table === 'searchchat' ? 'rid' : 'cid'; }

function arrOrNull(values) {
	if (!Array.isArray(values)) return null;
	const cleaned = values.filter(Boolean);
	return cleaned.length ? cleaned : null;
}

// ---------------------------------------------------------------------------
// Schema bootstrap
// ---------------------------------------------------------------------------

const FTS5_TABLES = [
	{ name: 'searchtopic', cols: 'id UNINDEXED, content, uid UNINDEXED, cid UNINDEXED' },
	{ name: 'searchpost', cols: 'id UNINDEXED, content, uid UNINDEXED, cid UNINDEXED' },
	{ name: 'searchchat', cols: 'id UNINDEXED, content, rid UNINDEXED, uid UNINDEXED' },
];

async function initSqlite() {
	const handle = getHandle();
	for (const { name, cols } of FTS5_TABLES) {
		await sql`CREATE VIRTUAL TABLE IF NOT EXISTS ${sql.id(name)} USING fts5(${sql.raw(cols)}, tokenize='porter unicode61')`.execute(handle);
	}
}

async function createPgTable(handle, table, otherCol, otherType) {
	await handle.schema.createTable(table).ifNotExists()
		.addColumn('id', 'text', col => col.notNull().primaryKey())
		.addColumn('content', 'text')
		.addColumn('uid', 'text')
		.addColumn(otherCol, otherType)
		.execute();

	// GIN expression-index over to_tsvector — schema-builder modelled, with
	// the function call as a raw expression (Kysely has no tsvector helper).
	const lang = sql.lit(searchLanguage);
	await handle.schema.createIndex(`idx__${table}__content`).ifNotExists()
		.on(table)
		.using('gin')
		.expression(sql`to_tsvector(${lang}, "content")`)
		.execute();
	await handle.schema.createIndex(`idx__${table}__uid`).ifNotExists().on(table).column('uid').execute();
	await handle.schema.createIndex(`idx__${table}__${otherCol}`).ifNotExists().on(table).column(otherCol).execute();
}

async function initPostgres() {
	const handle = getHandle();
	await createPgTable(handle, 'searchtopic', 'cid', 'text');
	await createPgTable(handle, 'searchpost', 'cid', 'text');
	await createPgTable(handle, 'searchchat', 'rid', 'bigint');
}

async function initMysql() {
	// FULLTEXT must be declared inline at CREATE TABLE time; MySQL has no
	// portable IF-NOT-EXISTS form for CREATE FULLTEXT INDEX, so the whole
	// table block stays raw.
	const handle = getHandle();
	const tables = [
		sql`CREATE TABLE IF NOT EXISTS searchtopic (id VARCHAR(255) PRIMARY KEY, content TEXT, uid VARCHAR(64), cid VARCHAR(64), FULLTEXT KEY ft_searchtopic_content (content), KEY idx_st_uid (uid), KEY idx_st_cid (cid)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		sql`CREATE TABLE IF NOT EXISTS searchpost (id VARCHAR(255) PRIMARY KEY, content TEXT, uid VARCHAR(64), cid VARCHAR(64), FULLTEXT KEY ft_searchpost_content (content), KEY idx_sp_uid (uid), KEY idx_sp_cid (cid)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
		sql`CREATE TABLE IF NOT EXISTS searchchat (id VARCHAR(255) PRIMARY KEY, content TEXT, rid BIGINT, uid VARCHAR(64), FULLTEXT KEY ft_searchchat_content (content), KEY idx_sc_rid (rid), KEY idx_sc_uid (uid)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
	];
	for (const t of tables) await t.execute(handle);
}

async function initDB() {
	const dialect = getDialect();
	if (dialect === 'sqlite') return initSqlite();
	if (dialect === 'mysql') return initMysql();
	if (isPgFamily(dialect)) return initPostgres();
	throw new Error(`[dbsearch/kysely] unsupported dialect: ${dialect}`);
}

let initPromise = null;
async function ensureInit() {
	if (!initPromise) {
		initPromise = initDB().catch((err) => {
			initPromise = null;
			throw err;
		});
	}
	return initPromise;
}

async function handleError(err) {
	if (!err) return;
	const code = err.code || '';
	const msg = err.message || '';
	const looksLikeMissingTable = code === '42P01' ||
		(code === 'SQLITE_ERROR' && /no such table/i.test(msg)) ||
		/no such table/i.test(msg) ||
		/doesn't exist/i.test(msg);
	if (looksLikeMissingTable) {
		winston.warn('dbsearch was not initialized');
		await initDB();
		return;
	}
	throw err;
}

exports.createIndices = async function (language) {
	if (language) searchLanguage = language;
	if (nconf.get('isPrimary') && !nconf.get('jobsDisabled')) {
		await ensureInit();
	}
};

exports.changeIndexLanguage = async function (language) {
	searchLanguage = language;
	pubsub.publish('dbsearch-language-changed', language);
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

async function searchSqlite(table, data, limit) {
	const handle = getHandle();
	const otherCol = otherColFor(table);
	const otherVals = arrOrNull(table === 'searchchat' ? data.roomId : data.cid);
	const uidValues = arrOrNull(data.uid);
	const lim = parseInt(limit, 10) || 50;
	const escaped = data.content ? `"${String(data.content).replace(/"/g, '""')}"` : null;

	let q = handle.selectFrom(table).select('id');
	// FTS5: `<table_name> MATCH <query>` — Kysely accepts the table name as
	// a column-style reference and any operator string.
	if (escaped) q = q.where(table, 'match', escaped);
	if (uidValues) q = q.where('uid', 'in', uidValues.map(String));
	if (otherVals) q = q.where(otherCol, 'in', otherVals.map(String));

	// `rank` (FTS5 hidden column) and `rowid` are plain column refs.
	q = q.orderBy(escaped ? 'rank' : 'rowid');
	const rows = await q.limit(lim).execute();
	return rows.map(r => r.id);
}

async function searchPostgres(table, data, limit) {
	const handle = getHandle();
	const filterColIsRid = table === 'searchchat';
	const filterCol = filterColIsRid ? 'rid' : 'cid';
	const filterValues = arrOrNull(filterColIsRid ? data.roomId : data.cid);
	const uidValues = arrOrNull(data.uid);
	const lim = parseInt(limit, 10) || 50;
	const lang = sql.lit(searchLanguage);
	const tsMatch = data.content ?
		sql`to_tsvector(${lang}::regconfig, content) @@ plainto_tsquery(${lang}::regconfig, ${data.content})` :
		null;
	const tsRank = data.content ?
		sql`ts_rank_cd(to_tsvector(${lang}::regconfig, content), plainto_tsquery(${lang}::regconfig, ${data.content}))` :
		null;

	let q = handle.selectFrom(table).select('id');
	if (tsMatch) q = q.where(tsMatch);
	if (uidValues) q = q.where('uid', 'in', uidValues.map(String));
	if (filterValues) q = q.where(filterCol, 'in', filterValues);

	q = tsRank ? q.orderBy(tsRank, 'desc').orderBy('id', 'asc') : q.orderBy('id', 'asc');
	const rows = await q.limit(lim).execute();
	return rows.map(r => r.id);
}

async function searchMysql(table, data, limit) {
	const handle = getHandle();
	const filterColIsRid = table === 'searchchat';
	const filterCol = filterColIsRid ? 'rid' : 'cid';
	const filterValues = arrOrNull(filterColIsRid ? data.roomId : data.cid);
	const uidValues = arrOrNull(data.uid);
	const lim = parseInt(limit, 10) || 50;

	let q = handle.selectFrom(table).select('id');
	// `MATCH(content) AGAINST(<query> IN BOOLEAN MODE)` — special-case
	// MySQL syntax (function-call-shaped predicate); raw is the clearest form.
	if (data.content) q = q.where(sql`MATCH(content) AGAINST(${data.content} IN BOOLEAN MODE)`);
	if (uidValues) q = q.where('uid', 'in', uidValues.map(String));
	if (filterValues) q = q.where(filterCol, 'in', filterValues);

	const rows = await q.limit(lim).execute();
	return rows.map(r => r.id);
}

// ---------------------------------------------------------------------------
// Index (insert / replace / upsert)
// ---------------------------------------------------------------------------

function rowFor(item, otherCol) {
	const { id, data: row } = item;
	const otherV = row[otherCol];
	return {
		id: String(id),
		content: row.content || null,
		uid: row.uid != null ? String(row.uid) : null,
		[otherCol]: otherV != null ?
			(otherCol === 'rid' ? Number(otherV) : String(otherV)) :
			null,
	};
}

async function indexSqlite(table, items) {
	const handle = getHandle();
	const otherCol = otherColFor(table);
	for (const item of items) {
		const row = rowFor(item, otherCol);
		// FTS5 has no UPSERT; delete+insert is the documented pattern.
		await handle.deleteFrom(table).where('id', '=', row.id).execute();
		await handle.insertInto(table).values(row).execute();
	}
}

async function indexMysql(table, items) {
	const handle = getHandle();
	const otherCol = otherColFor(table);
	for (const item of items) {
		await handle.replaceInto(table).values(rowFor(item, otherCol)).execute();
	}
}

async function indexPostgres(table, items) {
	const handle = getHandle();
	const otherCol = otherColFor(table);
	for (const item of items) {
		const row = rowFor(item, otherCol);
		await handle.insertInto(table)
			.values(row)
			.onConflict(oc => oc.column('id').doUpdateSet({
				content: eb => eb.fn.coalesce(eb.ref('excluded.content'), eb.ref(`${table}.content`)),
				uid: eb => eb.fn.coalesce(eb.ref('excluded.uid'), eb.ref(`${table}.uid`)),
				[otherCol]: eb => eb.fn.coalesce(eb.ref(`excluded.${otherCol}`), eb.ref(`${table}.${otherCol}`)),
			}))
			.execute();
	}
}

exports.searchIndex = async function (key, data, ids) {
	if (!ids || !ids.length) return;
	const dialect = getDialect();
	const table = `search${key}`;
	await ensureInit().catch(() => {});
	const items = ids.map((id, i) => ({ id: String(id), data: data[i] || {} }));

	try {
		if (dialect === 'sqlite') await indexSqlite(table, items);
		else if (dialect === 'mysql') await indexMysql(table, items);
		else if (isPgFamily(dialect)) await indexPostgres(table, items);
		else throw new Error(`unsupported dialect: ${dialect}`);
	} catch (err) {
		winston.error(`[dbsearch/kysely] indexing error: ${err.stack}`);
		await handleError(err);
		await exports.searchIndex(key, data, ids);
	}
};

function dispatchSearch(table, data, limit) {
	const dialect = getDialect();
	if (dialect === 'sqlite') return searchSqlite(table, data, limit);
	if (dialect === 'mysql') return searchMysql(table, data, limit);
	if (isPgFamily(dialect)) return searchPostgres(table, data, limit);
	throw new Error(`unsupported dialect: ${dialect}`);
}

exports.search = async function (key, data, limit) {
	await ensureInit().catch(() => {});
	try {
		return await dispatchSearch(`search${key}`, data, limit);
	} catch (err) {
		await handleError(err);
		return [];
	}
};

exports.searchRemove = async function (key, ids) {
	if (!key || !ids || !ids.length) return;
	const handle = getHandle();
	const table = `search${key}`;
	await ensureInit().catch(() => {});
	try {
		await handle.deleteFrom(table).where('id', 'in', ids.map(String)).execute();
	} catch (err) {
		await handleError(err);
	}
};

exports.chat = {};
exports.chat.index = async (data, ids) => exports.searchIndex('chat', data, ids);
exports.chat.search = async (data, limit) => {
	await ensureInit().catch(() => {});
	try {
		return await dispatchSearch('searchchat', data, limit);
	} catch (err) {
		await handleError(err);
		return [];
	}
};
exports.chat.remove = async (ids) => exports.searchRemove('chat', ids);

async function countRows(table) {
	const handle = getHandle();
	try {
		const row = await handle.selectFrom(table)
			.select(eb => eb.fn.countAll().as('c'))
			.executeTakeFirst();
		return parseInt(row && row.c, 10) || 0;
	} catch (_) {
		return 0;
	}
}
exports.getIndexedTopicCount = () => countRows('searchtopic');
exports.getIndexedPostCount = () => countRows('searchpost');
exports.getIndexedChatMessageCount = () => countRows('searchchat');
