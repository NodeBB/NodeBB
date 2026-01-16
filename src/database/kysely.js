'use strict';

const fs = require('fs');
const path = require('path');
const semver = require('semver');
const winston = require('winston');
const nconf = require('nconf');

const connection = require('./kysely/connection');

const kyselyModule = module.exports;

kyselyModule.questions = [
	{
		name: 'kysely:dialect',
		description: 'Database dialect (mysql, postgres, sqlite)',
		default: nconf.get('kysely:dialect') || nconf.get('defaults:kysely:dialect') || 'mysql',
	},
	{
		name: 'kysely:host',
		description: 'Host IP or address of your database instance',
		default: nconf.get('kysely:host') || nconf.get('defaults:kysely:host') || '127.0.0.1',
	},
	{
		name: 'kysely:port',
		description: 'Host port of your database instance',
		default: nconf.get('kysely:port') || nconf.get('defaults:kysely:port') || 3306,
	},
	{
		name: 'kysely:username',
		description: 'Database username',
		default: nconf.get('kysely:username') || nconf.get('defaults:kysely:username') || '',
	},
	{
		name: 'kysely:password',
		description: 'Password of your database',
		hidden: true,
		default: nconf.get('kysely:password') || nconf.get('defaults:kysely:password') || '',
		before: function (value) { value = value || nconf.get('kysely:password') || ''; return value; },
	},
	{
		name: 'kysely:database',
		description: 'Database name',
		default: nconf.get('kysely:database') || nconf.get('defaults:kysely:database') || 'nodebb',
	},
];

kyselyModule.init = async function (opts) {
	const db = await connection.createKyselyInstance(opts);
	kyselyModule.db = db;
	kyselyModule.pool = db;
	kyselyModule.client = db;
	kyselyModule.dialect = connection.getDialect(opts);
	
	try {
		await checkUpgrade(db);
	} catch (err) {
		winston.error(`NodeBB could not connect to your database. Error: ${err.message}`);
		throw err;
	}
};

async function checkUpgrade(db) {
	const {dialect} = kyselyModule;
	
	// Check if tables exist
	let tablesExist = false;
	try {
		if (dialect === 'mysql') {
			const result = await db.selectFrom('information_schema.tables')
				.select('table_name')
				.where('table_schema', '=', nconf.get('kysely:database') || 'nodebb')
				.where('table_name', '=', 'legacy_object')
				.execute();
			tablesExist = result.length > 0;
		} else if (dialect === 'postgres') {
			const result = await db.selectFrom('information_schema.tables')
				.select('table_name')
				.where('table_schema', '=', 'public')
				.where('table_name', '=', 'legacy_object')
				.execute();
			tablesExist = result.length > 0;
		} else if (dialect === 'sqlite') {
			const result = await db.selectFrom('sqlite_master')
				.select('name')
				.where('type', '=', 'table')
				.where('name', '=', 'legacy_object')
				.execute();
			tablesExist = result.length > 0;
		}
	} catch (err) {
		// Tables don't exist yet
		tablesExist = false;
	}
	
	if (tablesExist) {
		return;
	}
	
	// Create tables
	await createTables(db, dialect);
}

async function createTables(db, dialect) {
	// 1. Create legacy_object table - main registry for all keys
	await db.schema
		.createTable('legacy_object')
		.ifNotExists()
		.addColumn('_key', 'varchar(255)', col => col.primaryKey().notNull())
		.addColumn('type', 'varchar(10)', col => col.notNull())
		.addColumn('expireAt', dialect === 'sqlite' ? 'text' : 'timestamp')
		.execute();

	// 2. Create legacy_hash table - normalized field storage (key, field, value)
	await db.schema
		.createTable('legacy_hash')
		.ifNotExists()
		.addColumn('_key', 'varchar(255)', col => col.notNull())
		.addColumn('field', 'varchar(255)', col => col.notNull())
		.addColumn('value', 'text')
		.addPrimaryKeyConstraint('pk_legacy_hash', ['_key', 'field'])
		.execute();

	// 3. Create legacy_zset table - sorted set (key, value, score)
	await db.schema
		.createTable('legacy_zset')
		.ifNotExists()
		.addColumn('_key', 'varchar(255)', col => col.notNull())
		.addColumn('value', 'varchar(255)', col => col.notNull())
		.addColumn('score', dialect === 'sqlite' ? 'real' : 'decimal(20, 4)', col => col.notNull())
		.addPrimaryKeyConstraint('pk_legacy_zset', ['_key', 'value'])
		.execute();

	// 4. Create legacy_set table - set (key, member)
	await db.schema
		.createTable('legacy_set')
		.ifNotExists()
		.addColumn('_key', 'varchar(255)', col => col.notNull())
		.addColumn('member', 'varchar(255)', col => col.notNull())
		.addPrimaryKeyConstraint('pk_legacy_set', ['_key', 'member'])
		.execute();

	// 5. Create legacy_list table - indexed list (key, idx, value)
	await db.schema
		.createTable('legacy_list')
		.ifNotExists()
		.addColumn('_key', 'varchar(255)', col => col.notNull())
		.addColumn('idx', 'integer', col => col.notNull())
		.addColumn('value', 'text', col => col.notNull())
		.addPrimaryKeyConstraint('pk_legacy_list', ['_key', 'idx'])
		.execute();

	// 6. Create legacy_string table - simple key-value
	await db.schema
		.createTable('legacy_string')
		.ifNotExists()
		.addColumn('_key', 'varchar(255)', col => col.primaryKey().notNull())
		.addColumn('data', 'text', col => col.notNull())
		.execute();

	// Create indices
	await db.schema
		.createIndex('idx_legacy_object_expireAt')
		.ifNotExists()
		.on('legacy_object')
		.column('expireAt')
		.execute()
		.catch(() => {});

	await db.schema
		.createIndex('idx_legacy_zset_key_score')
		.ifNotExists()
		.on('legacy_zset')
		.columns(['_key', 'score'])
		.execute()
		.catch(() => {});

	await db.schema
		.createIndex('idx_legacy_list_key_idx')
		.ifNotExists()
		.on('legacy_list')
		.columns(['_key', 'idx'])
		.execute()
		.catch(() => {});

	await db.schema
		.createIndex('idx_legacy_hash_key')
		.ifNotExists()
		.on('legacy_hash')
		.column('_key')
		.execute()
		.catch(() => {});
}

kyselyModule.createSessionStore = async function (options) {
	const meta = require('../meta');
	const {dialect} = kyselyModule;
	
	// Create session table
	const db = kyselyModule.db || await connection.createKyselyInstance(options);
	
	await db.schema
		.createTable('sessions')
		.ifNotExists()
		.addColumn('sid', 'varchar(255)', col => col.primaryKey().notNull())
		.addColumn('sess', 'text', col => col.notNull())
		.addColumn('expireAt', dialect === 'sqlite' ? 'text' : 'timestamp', col => col.notNull())
		.execute();

	await db.schema
		.createIndex('idx_sessions_expireAt')
		.ifNotExists()
		.on('sessions')
		.column('expireAt')
		.execute()
		.catch(() => {});
	
	// Return a simple session store implementation
	const KyselySessionStore = require('./kysely/session-store');
	return new KyselySessionStore({
		db: db,
		dialect: dialect,
		ttl: meta.getSessionTTLSeconds(),
		pruneSessionInterval: nconf.get('isPrimary') ? 60 : false,
	});
};

kyselyModule.createIndices = async function () {
	if (!kyselyModule.db) {
		winston.warn('[database/createIndices] database not initialized');
		return;
	}
	
	winston.info('[database] Checking database indices.');
	const {db} = kyselyModule;
	
	try {
		await db.schema
			.createIndex('idx_legacy_object_expireAt')
			.ifNotExists()
			.on('legacy_object')
			.column('expireAt')
			.execute()
			.catch(() => {});

		await db.schema
			.createIndex('idx_legacy_zset_key_score')
			.ifNotExists()
			.on('legacy_zset')
			.columns(['_key', 'score'])
			.execute()
			.catch(() => {});

		await db.schema
			.createIndex('idx_legacy_list_key_idx')
			.ifNotExists()
			.on('legacy_list')
			.columns(['_key', 'idx'])
			.execute()
			.catch(() => {});

		await db.schema
			.createIndex('idx_legacy_hash_key')
			.ifNotExists()
			.on('legacy_hash')
			.column('_key')
			.execute()
			.catch(() => {});

		winston.info('[database] Checking database indices done!');
	} catch (err) {
		winston.error(`Error creating index ${err.message}`);
		throw err;
	}
};

kyselyModule.checkCompatibility = function (callback) {
	const kyselyPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../node_modules/kysely/package.json'), 'utf8'));
	kyselyModule.checkCompatibilityVersion(kyselyPkg.version, callback);
};

kyselyModule.checkCompatibilityVersion = function (version, callback) {
	if (semver.lt(version, '0.27.0')) {
		return callback(new Error('The `kysely` package is out-of-date, please run `./nodebb setup` again.'));
	}
	callback();
};

kyselyModule.info = async function (db) {
	if (!db) {
		db = kyselyModule.db;
	}
	
	const {dialect} = kyselyModule;
	const { sql } = require('kysely');
	
	const info = {
		kysely: true,
		dialect: dialect,
	};
	
	try {
		if (dialect === 'mysql') {
			const result = await sql`SELECT VERSION() as version`.execute(db);
			info.version = result.rows[0].version;
		} else if (dialect === 'postgres') {
			const result = await sql`SELECT current_setting('server_version') as version`.execute(db);
			info.version = result.rows[0].version;
		} else if (dialect === 'sqlite') {
			const result = await sql`SELECT sqlite_version() as version`.execute(db);
			info.version = result.rows[0].version;
		}
	} catch (err) {
		info.version = 'unknown';
	}
	
	info.raw = JSON.stringify(info, null, 4);
	return info;
};

kyselyModule.close = async function () {
	if (kyselyModule.db) {
		await kyselyModule.db.destroy();
	}
};

// Load sub-modules
require('./kysely/main')(kyselyModule);
require('./kysely/hash')(kyselyModule);
require('./kysely/sets')(kyselyModule);
require('./kysely/sorted')(kyselyModule);
require('./kysely/list')(kyselyModule);
require('./kysely/transaction')(kyselyModule);

require('../promisify')(kyselyModule, ['client', 'sessionStore', 'pool', 'db', 'transaction']);