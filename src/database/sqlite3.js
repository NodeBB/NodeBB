'use strict';

const winston = require('winston');
const nconf = require('nconf');
const session = require('express-session');
const semver = require('semver');

const connection = require('./sqlite3/connection');

const sqlite3Module = module.exports;

sqlite3Module.questions = [
	{
		name: 'sqlite3:path',
		description: 'Fully qualified path to database file',
		default: nconf.get('sqlite3:path') || '/var/local/nodebb.sqlite',
	},
];

sqlite3Module.init = async function () {
	try {
		sqlite3Module.db = connection.connect(nconf.get('sqlite3'));
		checkUpgrade(sqlite3Module.db);
	} catch (err) {
		winston.error(`NodeBB could not create the Sqlite3 database. Sqlite3 returned the following error: ${err.message}`);
		throw err;
	}
};

function checkUpgrade(db) {
	const res = db.prepare(`
SELECT EXISTS(SELECT * 
								FROM sqlite_master 
							 WHERE type='view' 
							   AND name='legacy_object_live') a`).get();
	if (res.a) {
		return;
	}

	db.exec(`
BEGIN;
CREATE TABLE "legacy_object" (
	"_key" TEXT NOT NULL
		PRIMARY KEY,
	"type" TEXT NOT NULL
		CHECK( "type" IN ('hash', 'zset', 'set', 'list', 'string') ),
	"expireAt" TEXT DEFAULT NULL,
	UNIQUE ( "_key", "type" )
);
CREATE TABLE "legacy_hash" (
	"_key" TEXT NOT NULL
		PRIMARY KEY,
	"data" TEXT NOT NULL,
	"type" TEXT NOT NULL
		DEFAULT 'hash'
		CHECK ( "type" = 'hash' ),
	CONSTRAINT "fk__legacy_hash__key"
		FOREIGN KEY ("_key", "type")
		REFERENCES "legacy_object"("_key", "type")
		ON UPDATE CASCADE
		ON DELETE CASCADE
);
CREATE TABLE "legacy_zset" (
	"_key" TEXT NOT NULL,
	"value" TEXT NOT NULL,
	"score" REAL NOT NULL,
	"type" TEXT NOT NULL
		DEFAULT 'zset'
		CHECK ( "type" = 'zset' ),
	PRIMARY KEY ("_key", "value"),
	CONSTRAINT "fk__legacy_zset__key"
		FOREIGN KEY ("_key", "type")
		REFERENCES "legacy_object"("_key", "type")
		ON UPDATE CASCADE
		ON DELETE CASCADE
);
CREATE TABLE "legacy_set" (
	"_key" TEXT NOT NULL,
	"member" TEXT NOT NULL,
	"type" TEXT NOT NULL
		DEFAULT 'set'
		CHECK ( "type" = 'set' ),
	PRIMARY KEY ("_key", "member"),
	CONSTRAINT "fk__legacy_set__key"
		FOREIGN KEY ("_key", "type")
		REFERENCES "legacy_object"("_key", "type")
		ON UPDATE CASCADE
		ON DELETE CASCADE
);
CREATE TABLE "legacy_list" (
	"_key" TEXT NOT NULL
		PRIMARY KEY,
	"array" TEXT NOT NULL,
	"type" TEXT NOT NULL
		DEFAULT 'list'
		CHECK ( "type" = 'list' ),
	CONSTRAINT "fk__legacy_list__key"
		FOREIGN KEY ("_key", "type")
		REFERENCES "legacy_object"("_key", "type")
		ON UPDATE CASCADE
		ON DELETE CASCADE
);
CREATE TABLE "legacy_string" (
	"_key" TEXT NOT NULL
		PRIMARY KEY,
	"data" TEXT NOT NULL,
	"type" TEXT NOT NULL
		DEFAULT 'string'
		CHECK ( "type" = 'string' ),
	CONSTRAINT "fk__legacy_string__key"
		FOREIGN KEY ("_key", "type")
		REFERENCES "legacy_object"("_key", "type")
		ON UPDATE CASCADE
		ON DELETE CASCADE
);
CREATE VIEW "legacy_object_live" AS
SELECT "_key", "type"
  FROM "legacy_object"
 WHERE "expireAt" IS NULL
    OR "expireAt" > CURRENT_TIMESTAMP;
COMMIT;
	`);
}

sqlite3Module.createSessionStore = async function (options) {
	const meta = require('../meta');
	const db = connection.connect(options);
	const sessionStore = require('better-sqlite3-session-store')(session);
	return new sessionStore({
		client: db,
		expired: {
			clear: true,
			intervalMs: meta.getSessionTTLSeconds() * 1000
		}		
	});
};

sqlite3Module.createIndices = function (callback) {
	if (!sqlite3Module.db) {
		winston.warn('[database/createIndices] database not initialized');
		return callback();
	}

	const db = sqlite3Module.db;
	winston.info('[database] Checking database indices.');
	try {
		db.exec(`
CREATE INDEX IF NOT EXISTS "idx__legacy_zset__key__score" ON "legacy_zset"("_key" ASC, "score" DESC);	
CREATE INDEX IF NOT EXISTS "idx__legacy_object__expireAt" ON "legacy_object"("expireAt" ASC);
		`);	
	} catch (err) {
		winston.error(`Error creating index ${err.message}`);
		return callback(err);
	}
	winston.info('[database] Checking database indices done!');
	callback();
};

sqlite3Module.checkCompatibility = function (callback) {
	const sqlite3Pkg = require('better-sqlite3/package.json');
	sqlite3Module.checkCompatibilityVersion(sqlite3Pkg.version, callback);
};

sqlite3Module.checkCompatibilityVersion = function (version, callback) {
	if (semver.lt(version, '8.3.0')) {
		return callback(new Error('The `better-sqlite3` package is out-of-date, please run `./nodebb setup` again.'));
	}

	callback();
};

sqlite3Module.info = async function (db) {
	if (!db) {
		db = connection.connect(nconf.get('sqlite3'));
	}
	sqlite3Module.db = sqlite3Module.db || db;
	const res = db.prepare(`
		SELECT true "sqlite3",
			sqlite_version() "version"
	`).get();
	return {
		...res,
		raw: JSON.stringify(res, null, 4),
	};
};

sqlite3Module.close = async function () {
	sqlite3Module.db.close();
};

require('./sqlite3/main')(sqlite3Module);
require('./sqlite3/hash')(sqlite3Module);
require('./sqlite3/sets')(sqlite3Module);
require('./sqlite3/sorted')(sqlite3Module);
require('./sqlite3/list')(sqlite3Module);
require('./sqlite3/transaction')(sqlite3Module);

require('../promisify')(sqlite3Module, ['client', 'sessionStore', 'pool', 'transaction']);
