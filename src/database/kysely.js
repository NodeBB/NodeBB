'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const semver = require('semver');
const winston = require('winston');
const nconf = require('nconf');
const { sql } = require('kysely');

const connection = require('./kysely/connection');
const features = require('./kysely/features');

// -- Plugin patch self-heal -----------------------------------------------------
// Mirror patches/<pkg>/* into node_modules/<pkg>/* on every load. NodeBB
// plugins like nodebb-plugin-dbsearch ship adapters for mongo/postgres/redis
// only; we carry our own kysely.js adapter under patches/ and copy it into the
// installed plugin tree at module-load time. Avoids a postinstall hook (which
// itself broke `test/package-install.js`).
(function applyPatches() {
	try {
		const patchRoot = path.join(__dirname, '../../patches');
		const nm = path.join(__dirname, '../../node_modules');
		if (!fs.existsSync(patchRoot)) return;
		for (const pkg of fs.readdirSync(patchRoot, { withFileTypes: true })) {
			if (!pkg.isDirectory() || !fs.existsSync(path.join(nm, pkg.name))) continue;
			fs.cpSync(path.join(patchRoot, pkg.name), path.join(nm, pkg.name), { recursive: true });
		}
	} catch { /* best-effort */ }
}());

// -- Fork-safe config propagation ----------------------------------------------
// `child_process.fork()` does NOT inherit nconf runtime state, only the
// parent's `process.env`. The test harness mutates `nconf` at runtime; without
// this snapshot/restore, forked children re-read config.json and connect to
// the wrong DB.
const FORK_ENV = 'KYSELY_FORK_CONFIG';
function snapshotForFork(opts) {
	try {
		const cfg = opts || nconf.get('kysely');
		if (!cfg || typeof cfg !== 'object') return;
		const p = path.join(os.tmpdir(), `nodebb-kysely-fork-${process.pid}.json`);
		fs.writeFileSync(p, JSON.stringify(cfg));
		process.env[FORK_ENV] = p;
	} catch { /* best-effort */ }
}
function restoreFromFork() {
	const p = process.env[FORK_ENV];
	if (!p || !fs.existsSync(p)) return;
	try {
		const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
		if (cfg && typeof cfg === 'object') nconf.set('kysely', cfg);
	} catch { /* best-effort */ }
}

const kyselyModule = module.exports;

// -- Setup prompts -------------------------------------------------------------
const dflt = (key, fallback) => nconf.get(`kysely:${key}`) || nconf.get(`defaults:kysely:${key}`) || fallback;
const initialDialect = dflt('dialect', 'sqlite');
kyselyModule.questions = [
	{ name: 'kysely:dialect', description: 'Database dialect (mysql, postgres, sqlite, pglite)', default: initialDialect },
	{ name: 'kysely:host', description: 'Host IP or address of your database instance', default: dflt('host', '127.0.0.1') },
	{ name: 'kysely:port', description: 'Host port of your database instance', default: dflt('port', 3306) },
	{ name: 'kysely:username', description: 'Database username', default: dflt('username', '') },
	{
		name: 'kysely:password', description: 'Password of your database', hidden: true,
		default: dflt('password', ''), before: v => v || dflt('password', ''), 
	},
	{
		name: 'kysely:database', description: 'Database name',
		default: dflt('database', initialDialect === 'sqlite' ? 'nodebb.db' : 'nodebb'), 
	},
];

// -- Schema --------------------------------------------------------------------
// Kysely's data-type-parser only knows the standard SQL keyword whitelist
// below. Everything else must be `sql.raw()` to bypass tokenisation.
const PARSER_KNOWN = /^(text|varchar|char|integer|int|bigint|smallint|tinyint|real|double|float|numeric|decimal|boolean|bool|date|datetime|time|timestamp|timestamptz)(\s*\(\d+(,\s*\d+)?\))?$/i;
const T = type => (PARSER_KNOWN.test(type) ? type : sql.raw(type));

const schemaFor = (dialect) => {
	const ts = T(features.getTimestampType(dialect));
	const fk = c => c.notNull().references('legacy_object._key').onDelete('cascade');
	const score = T(dialect === 'sqlite' ? 'real' : 'decimal(20, 4)');
	return {
		tables: {
			legacy_object: q => q
				.addColumn('_key', T('varchar(255)'), c => c.primaryKey().notNull())
				.addColumn('type', T('varchar(10)'), c => c.notNull())
				.addColumn('expireAt', ts),
			legacy_hash: q => q
				.addColumn('_key', T('varchar(255)'), fk)
				.addColumn('field', T('varchar(255)'), c => c.notNull())
				.addColumn('value', T('text'))
				.addPrimaryKeyConstraint('pk_legacy_hash', ['_key', 'field']),
			legacy_zset: q => q
				.addColumn('_key', T('varchar(255)'), fk)
				.addColumn('value', T('varchar(255)'), c => c.notNull())
				.addColumn('score', score, c => c.notNull())
				.addPrimaryKeyConstraint('pk_legacy_zset', ['_key', 'value']),
			legacy_set: q => q
				.addColumn('_key', T('varchar(255)'), fk)
				.addColumn('member', T('varchar(255)'), c => c.notNull())
				.addPrimaryKeyConstraint('pk_legacy_set', ['_key', 'member']),
			legacy_list: q => q
				.addColumn('_key', T('varchar(255)'), fk)
				.addColumn('idx', T('integer'), c => c.notNull())
				.addColumn('value', T('text'), c => c.notNull())
				.addPrimaryKeyConstraint('pk_legacy_list', ['_key', 'idx']),
			legacy_string: q => q
				.addColumn('_key', T('varchar(255)'), c => c.primaryKey().notNull().references('legacy_object._key').onDelete('cascade'))
				.addColumn('data', T('text'), c => c.notNull()),
		},
		indices: {
			idx_legacy_object_expireAt: q => q.on('legacy_object').column('expireAt'),
			idx_legacy_zset_key_score: q => q.on('legacy_zset').columns(['_key', 'score']),
			idx_legacy_list_key_idx: q => q.on('legacy_list').columns(['_key', 'idx']),
			idx_legacy_hash_key: q => q.on('legacy_hash').column('_key'),
		},
	};
};

const safeTable = (db, name, build) => build(db.schema.createTable(name).ifNotExists()).execute();
const safeIndex = (db, name, build) => build(db.schema.createIndex(name).ifNotExists()).execute().catch(() => {});

const applySchema = async (db, dialect) => {
	const s = schemaFor(dialect);
	for (const [n, b] of Object.entries(s.tables)) await safeTable(db, n, b);
	for (const [n, b] of Object.entries(s.indices)) await safeIndex(db, n, b);
};

// -- Per-dialect lookup queries ------------------------------------------------
const TABLE_EXISTS = {
	mysql: db => db.selectFrom('information_schema.tables').select('table_name')
		.where('table_schema', '=', nconf.get('kysely:database') || 'nodebb')
		.where('table_name', '=', 'legacy_object').execute(),
	postgres: db => db.selectFrom('information_schema.tables').select('table_name')
		.where('table_schema', '=', 'public')
		.where('table_name', '=', 'legacy_object').execute(),
	sqlite: db => db.selectFrom('sqlite_master').select('name')
		.where('type', '=', 'table').where('name', '=', 'legacy_object').execute(),
};

const VERSION_QUERY = {
	mysql: db => sql`SELECT VERSION() as version`.execute(db),
	postgres: db => sql`SELECT current_setting('server_version') as version`.execute(db),
	sqlite: db => sql`SELECT sqlite_version() as version`.execute(db),
};

// PGlite is wire-compatible with PostgreSQL.
const sqlOf = d => (d === 'pglite' ? 'postgres' : d);

// -- Public API ----------------------------------------------------------------
kyselyModule.init = async (opts) => {
	if (!opts) restoreFromFork();
	const db = await connection.createKyselyInstance(opts);
	kyselyModule.db = kyselyModule.pool = kyselyModule.client = db;
	snapshotForFork(opts || nconf.get('kysely'));
	const original = connection.getDialect(opts);
	kyselyModule.originalDialect = original;
	kyselyModule.dialect = sqlOf(original);
	try {
		const probe = TABLE_EXISTS[kyselyModule.dialect];
		const exists = probe ? (await probe(db).catch(() => [])).length > 0 : false;
		if (!exists) await applySchema(db, kyselyModule.dialect);
	} catch (err) {
		winston.error(`NodeBB could not connect to your database. Error: ${err.message}`);
		throw err;
	}
	kyselyModule.features = await features.detect(db, kyselyModule.dialect);
	kyselyModule.supportsLocking = kyselyModule.features.locking;
	if (kyselyModule.features.detectedDialect) kyselyModule.dialect = kyselyModule.features.detectedDialect;
	kyselyModule.context = { dialect: kyselyModule.dialect, features: kyselyModule.features };
	winston.info(`[database/kysely] Detected features: ${JSON.stringify(kyselyModule.features)}`);
};

kyselyModule.createSessionStore = async (options) => {
	const meta = require('../meta');
	const db = kyselyModule.db || await connection.createKyselyInstance(options);
	await safeTable(db, 'sessions', q => q
		.addColumn('sid', T('varchar(255)'), c => c.primaryKey().notNull())
		.addColumn('sess', T('text'), c => c.notNull())
		.addColumn('expireAt', T(features.getTimestampType(kyselyModule.dialect)), c => c.notNull()));
	await safeIndex(db, 'idx_sessions_expireAt', q => q.on('sessions').column('expireAt'));
	const Store = require('./kysely/session-store');
	return new Store({
		db, dialect: kyselyModule.dialect, helpers: kyselyModule.helpers,
		ttl: meta.getSessionTTLSeconds(),
		pruneSessionInterval: nconf.get('isPrimary') ? 60 : false,
	});
};

kyselyModule.createIndices = async () => {
	if (!kyselyModule.db) {
		winston.warn('[database/createIndices] database not initialized');
		return;
	}
	winston.info('[database] Checking database indices.');
	try {
		const { indices } = schemaFor(kyselyModule.dialect);
		for (const [n, b] of Object.entries(indices)) await safeIndex(kyselyModule.db, n, b);
		winston.info('[database] Checking database indices done!');
	} catch (err) {
		winston.error(`Error creating index ${err.message}`);
		throw err;
	}
};

kyselyModule.checkCompatibility = (cb) => {
	const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../node_modules/kysely/package.json'), 'utf8'));
	kyselyModule.checkCompatibilityVersion(pkg.version, cb);
};
kyselyModule.checkCompatibilityVersion = (version, cb) => {
	if (semver.lt(version, '0.27.0')) {
		return cb(new Error('The `kysely` package is out-of-date, please run `./nodebb setup` again.'));
	}
	cb();
};

kyselyModule.info = async (db) => {
	db = db || kyselyModule.db;
	const info = { kysely: true, dialect: kyselyModule.dialect };
	try {
		const v = VERSION_QUERY[kyselyModule.dialect];
		if (v) info.version = (await v(db)).rows[0].version;
	} catch { info.version = 'unknown'; }
	info.raw = JSON.stringify(info, null, 4);
	return info;
};

kyselyModule.close = async () => kyselyModule.db && kyselyModule.db.destroy();

kyselyModule.checkpoint = async () => {
	if (kyselyModule.db && kyselyModule.dialect === 'sqlite') {
		await sql`PRAGMA wal_checkpoint(TRUNCATE)`.execute(kyselyModule.db);
	}
};

// Sub-modules — order matters: helpers must load first.
for (const mod of ['helpers', 'main', 'hash', 'sets', 'sorted', 'list', 'transaction']) {
	require(`./kysely/${mod}`)(kyselyModule);
}

require('../promisify')(kyselyModule, ['client', 'sessionStore', 'pool', 'db', 'transaction', 'helpers']);
