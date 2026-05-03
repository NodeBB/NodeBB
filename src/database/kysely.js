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
// Score column: SQLite stores floats as IEEE-754 (REAL); networked dialects
// use DECIMAL for predictable arithmetic and stable indexed comparison.
const SCORE_TYPE = { sqlite: 'real', mysql: 'decimal(20, 4)', postgres: 'decimal(20, 4)', pglite: 'decimal(20, 4)' };
const tryIdx = q => q.execute().catch(() => {}); // CREATE INDEX is best-effort; ignore "already exists" races.
const fkObjectKey = c => c.notNull().references('legacy_object._key').onDelete('cascade');

// MySQL table options:
//   ROW_FORMAT=DYNAMIC   — required for VARCHAR(191) composite PKs under
//                          utf8mb4 (lifts COMPACT's 767-byte index limit
//                          to 3072 bytes when paired with Barracuda).
//   COLLATE=utf8mb4_bin  — case-sensitive, codepoint-ordered comparisons,
//                          matching the Postgres/SQLite/Redis default
//                          NodeBB tests assume. utf8mb4_unicode_ci treats
//                          punctuation (`:`, ` `) as equal at the primary
//                          collation level, breaking lex range queries on
//                          `legacy_zset.value`.
// No-op on non-MySQL dialects.
const mysqlOpts = (dialect, builder) => (
	dialect === 'mysql' ? builder.modifyEnd(sql`ROW_FORMAT=DYNAMIC DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`) : builder
);

const applyIndices = async (db) => {
	await tryIdx(db.schema.createIndex('idx_legacy_object_expireAt').ifNotExists().on('legacy_object').column('expireAt'));
	await tryIdx(db.schema.createIndex('idx_legacy_zset_key_score').ifNotExists().on('legacy_zset').columns(['_key', 'score']));
	await tryIdx(db.schema.createIndex('idx_legacy_list_key_idx').ifNotExists().on('legacy_list').columns(['_key', 'idx']));
	await tryIdx(db.schema.createIndex('idx_legacy_hash_key').ifNotExists().on('legacy_hash').column('_key'));
};

// Schema DDL is sequential — every child table FK-references `legacy_object`.
const applySchema = async (db, dialect) => {
	const ts = features.getTimestampType(dialect);
	const score = SCORE_TYPE[dialect] || 'real';

	await mysqlOpts(dialect, db.schema.createTable('legacy_object').ifNotExists()
		.addColumn('_key', 'varchar(191)', c => c.primaryKey().notNull())
		.addColumn('type', 'varchar(10)', c => c.notNull())
		.addColumn('expireAt', ts)).execute();

	// Hash storage: stringly-typed `value` column with a tiny `value_type`
	// tag that lets us recover the original JS type on read.
	//   value_type = 'n' → number, 'b' → boolean, NULL → string (default).
	// `value` is always TEXT so plain SQL inspection still works; the tag is
	// what makes round-tripping accurate. Legacy rows with NULL type fall
	// through to string semantics — fully back-compat with the prior schema.
	await mysqlOpts(dialect, db.schema.createTable('legacy_hash').ifNotExists()
		.addColumn('_key', 'varchar(191)', fkObjectKey)
		.addColumn('field', 'varchar(191)', c => c.notNull())
		.addColumn('value', 'text')
		.addColumn('value_type', 'char(1)')
		.addPrimaryKeyConstraint('pk_legacy_hash', ['_key', 'field'])).execute();

	await mysqlOpts(dialect, db.schema.createTable('legacy_zset').ifNotExists()
		.addColumn('_key', 'varchar(191)', fkObjectKey)
		.addColumn('value', 'varchar(191)', c => c.notNull())
		.addColumn('score', score, c => c.notNull())
		.addPrimaryKeyConstraint('pk_legacy_zset', ['_key', 'value'])).execute();

	await mysqlOpts(dialect, db.schema.createTable('legacy_set').ifNotExists()
		.addColumn('_key', 'varchar(191)', fkObjectKey)
		.addColumn('member', 'varchar(191)', c => c.notNull())
		.addPrimaryKeyConstraint('pk_legacy_set', ['_key', 'member'])).execute();

	await mysqlOpts(dialect, db.schema.createTable('legacy_list').ifNotExists()
		.addColumn('_key', 'varchar(191)', fkObjectKey)
		.addColumn('idx', 'bigint', c => c.notNull())
		.addColumn('value', 'text', c => c.notNull())
		.addPrimaryKeyConstraint('pk_legacy_list', ['_key', 'idx'])).execute();

	await mysqlOpts(dialect, db.schema.createTable('legacy_string').ifNotExists()
		.addColumn('_key', 'varchar(191)', c => c.primaryKey().notNull().references('legacy_object._key').onDelete('cascade'))
		.addColumn('data', 'text', c => c.notNull())).execute();

	await applyIndices(db);
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
	await db.schema.createTable('sessions').ifNotExists()
		.addColumn('sid', 'varchar(191)', c => c.primaryKey().notNull())
		.addColumn('sess', 'text', c => c.notNull())
		.addColumn('expireAt', features.getTimestampType(kyselyModule.dialect), c => c.notNull())
		.execute();
	await tryIdx(db.schema.createIndex('idx_sessions_expireAt').ifNotExists().on('sessions').column('expireAt'));
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
		await applyIndices(kyselyModule.db);
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

// Sub-modules — order matters: helpers must load first.
for (const mod of ['helpers', 'main', 'hash', 'sets', 'sorted', 'list', 'transaction']) {
	require(`./kysely/${mod}`)(kyselyModule);
}

require('../promisify')(kyselyModule, ['client', 'sessionStore', 'pool', 'db', 'transaction', 'helpers']);
