'use strict';

const winston = require('winston');
const nconf = require('nconf');
const session = require('express-session');
const semver = require('semver');

const connection = require('./postgres/connection');

const postgresModule = module.exports;

postgresModule.questions = [
	{
		name: 'postgres:host',
		description: 'Host IP or address of your PostgreSQL instance',
		default: nconf.get('postgres:host') || nconf.get('defaults:postgres:host') || '127.0.0.1',
	},
	{
		name: 'postgres:port',
		description: 'Host port of your PostgreSQL instance',
		default: nconf.get('postgres:port') || nconf.get('defaults:postgres:port') || 5432,
	},
	{
		name: 'postgres:username',
		description: 'PostgreSQL username',
		default: nconf.get('postgres:username') || nconf.get('defaults:postgres:username') || '',
	},
	{
		name: 'postgres:password',
		description: 'Password of your PostgreSQL database',
		hidden: true,
		default: nconf.get('postgres:password') || nconf.get('defaults:postgres:password') || '',
		before: function (value) { value = value || nconf.get('postgres:password') || ''; return value; },
	},
	{
		name: 'postgres:database',
		description: 'PostgreSQL database name',
		default: nconf.get('postgres:database') || nconf.get('defaults:postgres:database') || 'nodebb',
	},
	{
		name: 'postgres:ssl',
		description: 'Enable SSL for PostgreSQL database access',
		default: nconf.get('postgres:ssl') || nconf.get('defaults:postgres:ssl') || false,
	},
];

postgresModule.init = async function (opts) {
	const { Pool } = require('pg');
	const connOptions = connection.getConnectionOptions(opts);
	const pool = new Pool(connOptions);
	postgresModule.pool = pool;
	postgresModule.client = pool;
	const client = await pool.connect();
	try {
		await checkUpgrade(client);
	} catch (err) {
		winston.error(`NodeBB could not connect to your PostgreSQL database. PostgreSQL returned the following error: ${err.message}`);
		throw err;
	} finally {
		client.release();
	}
};


async function checkUpgrade(client) {
	const res = await client.query(`
SELECT EXISTS(SELECT *
                FROM "information_schema"."columns"
               WHERE "table_schema" = 'public'
                 AND "table_name" = 'objects'
                 AND "column_name" = 'data') a,
       EXISTS(SELECT *
                FROM "information_schema"."columns"
               WHERE "table_schema" = 'public'
                 AND "table_name" = 'legacy_hash'
                 AND "column_name" = '_key') b,
       EXISTS(SELECT *
                FROM "information_schema"."routines"
               WHERE "routine_schema" = 'public'
                 AND "routine_name" = 'nodebb_get_sorted_set_members') c,
		EXISTS(SELECT *
				FROM "information_schema"."routines"
			   WHERE "routine_schema" = 'public'
				 AND "routine_name" = 'nodebb_get_sorted_set_members_withscores') d`);

	if (res.rows[0].a && res.rows[0].b && res.rows[0].c && res.rows[0].d) {
		return;
	}

	await client.query(`BEGIN`);
	try {
		if (!res.rows[0].b) {
			await client.query(`
CREATE TYPE LEGACY_OBJECT_TYPE AS ENUM (
	'hash', 'zset', 'set', 'list', 'string'
)`);
			await client.query(`
CREATE TABLE "legacy_object" (
	"_key" TEXT NOT NULL
		PRIMARY KEY,
	"type" LEGACY_OBJECT_TYPE NOT NULL,
	"expireAt" TIMESTAMPTZ DEFAULT NULL,
	UNIQUE ( "_key", "type" )
)`);
			await client.query(`
CREATE TABLE "legacy_hash" (
	"_key" TEXT NOT NULL
		PRIMARY KEY,
	"data" JSONB NOT NULL,
	"type" LEGACY_OBJECT_TYPE NOT NULL
		DEFAULT 'hash'::LEGACY_OBJECT_TYPE
		CHECK ( "type" = 'hash' ),
	CONSTRAINT "fk__legacy_hash__key"
		FOREIGN KEY ("_key", "type")
		REFERENCES "legacy_object"("_key", "type")
		ON UPDATE CASCADE
		ON DELETE CASCADE
)`);
			await client.query(`
CREATE TABLE "legacy_zset" (
	"_key" TEXT NOT NULL,
	"value" TEXT NOT NULL,
	"score" NUMERIC NOT NULL,
	"type" LEGACY_OBJECT_TYPE NOT NULL
		DEFAULT 'zset'::LEGACY_OBJECT_TYPE
		CHECK ( "type" = 'zset' ),
	PRIMARY KEY ("_key", "value"),
	CONSTRAINT "fk__legacy_zset__key"
		FOREIGN KEY ("_key", "type")
		REFERENCES "legacy_object"("_key", "type")
		ON UPDATE CASCADE
		ON DELETE CASCADE
)`);
			await client.query(`
CREATE TABLE "legacy_set" (
	"_key" TEXT NOT NULL,
	"member" TEXT NOT NULL,
	"type" LEGACY_OBJECT_TYPE NOT NULL
		DEFAULT 'set'::LEGACY_OBJECT_TYPE
		CHECK ( "type" = 'set' ),
	PRIMARY KEY ("_key", "member"),
	CONSTRAINT "fk__legacy_set__key"
		FOREIGN KEY ("_key", "type")
		REFERENCES "legacy_object"("_key", "type")
		ON UPDATE CASCADE
		ON DELETE CASCADE
)`);
			await client.query(`
CREATE TABLE "legacy_list" (
	"_key" TEXT NOT NULL
		PRIMARY KEY,
	"array" TEXT[] NOT NULL,
	"type" LEGACY_OBJECT_TYPE NOT NULL
		DEFAULT 'list'::LEGACY_OBJECT_TYPE
		CHECK ( "type" = 'list' ),
	CONSTRAINT "fk__legacy_list__key"
		FOREIGN KEY ("_key", "type")
		REFERENCES "legacy_object"("_key", "type")
		ON UPDATE CASCADE
		ON DELETE CASCADE
)`);
			await client.query(`
CREATE TABLE "legacy_string" (
	"_key" TEXT NOT NULL
		PRIMARY KEY,
	"data" TEXT NOT NULL,
	"type" LEGACY_OBJECT_TYPE NOT NULL
		DEFAULT 'string'::LEGACY_OBJECT_TYPE
		CHECK ( "type" = 'string' ),
	CONSTRAINT "fk__legacy_string__key"
		FOREIGN KEY ("_key", "type")
		REFERENCES "legacy_object"("_key", "type")
		ON UPDATE CASCADE
		ON DELETE CASCADE
)`);

			if (res.rows[0].a) {
				await client.query(`
INSERT INTO "legacy_object" ("_key", "type", "expireAt")
SELECT DISTINCT "data"->>'_key',
                CASE WHEN (SELECT COUNT(*)
                             FROM jsonb_object_keys("data" - 'expireAt')) = 2
                     THEN CASE WHEN ("data" ? 'value')
                                 OR ("data" ? 'data')
                               THEN 'string'
                               WHEN "data" ? 'array'
                               THEN 'list'
                               WHEN "data" ? 'members'
                               THEN 'set'
                               ELSE 'hash'
                          END
                     WHEN (SELECT COUNT(*)
                             FROM jsonb_object_keys("data" - 'expireAt')) = 3
                     THEN CASE WHEN ("data" ? 'value')
                                AND ("data" ? 'score')
                               THEN 'zset'
                               ELSE 'hash'
                          END
                     ELSE 'hash'
                END::LEGACY_OBJECT_TYPE,
                CASE WHEN ("data" ? 'expireAt')
                     THEN to_timestamp(("data"->>'expireAt')::double precision / 1000)
                     ELSE NULL
                END
  FROM "objects"`);
				await client.query(`
INSERT INTO "legacy_hash" ("_key", "data")
SELECT "data"->>'_key',
       "data" - '_key' - 'expireAt'
  FROM "objects"
 WHERE CASE WHEN (SELECT COUNT(*)
                    FROM jsonb_object_keys("data" - 'expireAt')) = 2
            THEN NOT (("data" ? 'value')
                   OR ("data" ? 'data')
                   OR ("data" ? 'members')
                   OR ("data" ? 'array'))
            WHEN (SELECT COUNT(*)
                    FROM jsonb_object_keys("data" - 'expireAt')) = 3
            THEN NOT (("data" ? 'value')
                  AND ("data" ? 'score'))
            ELSE TRUE
       END`);
				await client.query(`
INSERT INTO "legacy_zset" ("_key", "value", "score")
SELECT "data"->>'_key',
       "data"->>'value',
       ("data"->>'score')::NUMERIC
  FROM "objects"
 WHERE (SELECT COUNT(*)
          FROM jsonb_object_keys("data" - 'expireAt')) = 3
   AND ("data" ? 'value')
   AND ("data" ? 'score')`);
				await client.query(`
INSERT INTO "legacy_set" ("_key", "member")
SELECT "data"->>'_key',
       jsonb_array_elements_text("data"->'members')
  FROM "objects"
 WHERE (SELECT COUNT(*)
          FROM jsonb_object_keys("data" - 'expireAt')) = 2
   AND ("data" ? 'members')`);
				await client.query(`
INSERT INTO "legacy_list" ("_key", "array")
SELECT "data"->>'_key',
       ARRAY(SELECT t
               FROM jsonb_array_elements_text("data"->'list') WITH ORDINALITY l(t, i)
              ORDER BY i ASC)
  FROM "objects"
 WHERE (SELECT COUNT(*)
          FROM jsonb_object_keys("data" - 'expireAt')) = 2
   AND ("data" ? 'array')`);
				await client.query(`
INSERT INTO "legacy_string" ("_key", "data")
SELECT "data"->>'_key',
       CASE WHEN "data" ? 'value'
            THEN "data"->>'value'
            ELSE "data"->>'data'
       END
  FROM "objects"
 WHERE (SELECT COUNT(*)
          FROM jsonb_object_keys("data" - 'expireAt')) = 2
   AND (("data" ? 'value')
     OR ("data" ? 'data'))`);
				await client.query(`DROP TABLE "objects" CASCADE`);
				await client.query(`DROP FUNCTION "fun__objects__expireAt"() CASCADE`);
			}
			await client.query(`
CREATE VIEW "legacy_object_live" AS
SELECT "_key", "type"
  FROM "legacy_object"
 WHERE "expireAt" IS NULL
    OR "expireAt" > CURRENT_TIMESTAMP`);
		}

		if (!res.rows[0].c) {
			await client.query(`
CREATE FUNCTION "nodebb_get_sorted_set_members"(TEXT) RETURNS TEXT[] AS $$
    SELECT array_agg(z."value" ORDER BY z."score" ASC)
      FROM "legacy_object_live" o
     INNER JOIN "legacy_zset" z
             ON o."_key" = z."_key"
            AND o."type" = z."type"
          WHERE o."_key" = $1
$$ LANGUAGE sql
STABLE
STRICT
PARALLEL SAFE`);
		}

		if (!res.rows[0].d) {
			await client.query(`
			CREATE FUNCTION "nodebb_get_sorted_set_members_withscores"(TEXT) RETURNS JSON AS $$
				SELECT json_agg(json_build_object('value', z."value", 'score', z."score") ORDER BY z."score" ASC) as item
				  FROM "legacy_object_live" o
				 INNER JOIN "legacy_zset" z
						 ON o."_key" = z."_key"
						AND o."type" = z."type"
					  WHERE o."_key" = $1
			$$ LANGUAGE sql
			STABLE
			STRICT
			PARALLEL SAFE`);
		}
	} catch (ex) {
		await client.query(`ROLLBACK`);
		throw ex;
	}
	await client.query(`COMMIT`);
}

postgresModule.createSessionStore = async function (options) {
	const meta = require('../meta');

	function done(db) {
		const sessionStore = require('connect-pg-simple')(session);
		return new sessionStore({
			pool: db,
			ttl: meta.getSessionTTLSeconds(),
			pruneSessionInterval: nconf.get('isPrimary') ? 60 : false,
		});
	}

	const db = await connection.connect(options);

	if (!nconf.get('isPrimary')) {
		return done(db);
	}

	await db.query(`
CREATE TABLE IF NOT EXISTS "session" (
	"sid" CHAR(32) NOT NULL
		COLLATE "C"
		PRIMARY KEY,
	"sess" JSONB NOT NULL,
	"expire" TIMESTAMPTZ NOT NULL
) WITHOUT OIDS;

CREATE INDEX IF NOT EXISTS "session_expire_idx" ON "session"("expire");

ALTER TABLE "session"
	ALTER "sid" SET STORAGE MAIN,
	CLUSTER ON "session_expire_idx";`);

	return done(db);
};

postgresModule.createIndices = async function () {
	if (!postgresModule.pool) {
		winston.warn('[database/createIndices] database not initialized');
		return;
	}
	winston.info('[database] Checking database indices.');
	try {
		await postgresModule.pool.query(`CREATE INDEX IF NOT EXISTS "idx__legacy_zset__key__score" ON "legacy_zset"("_key" ASC, "score" DESC)`);
		await postgresModule.pool.query(`CREATE INDEX IF NOT EXISTS "idx__legacy_object__expireAt" ON "legacy_object"("expireAt" ASC)`);
		winston.info('[database] Checking database indices done!');
	} catch (err) {
		winston.error(`Error creating index ${err.message}`);
		throw err;
	}
};

postgresModule.checkCompatibility = function (callback) {
	const postgresPkg = require('pg/package.json');
	postgresModule.checkCompatibilityVersion(postgresPkg.version, callback);
};

postgresModule.checkCompatibilityVersion = function (version, callback) {
	if (semver.lt(version, '7.0.0')) {
		return callback(new Error('The `pg` package is out-of-date, please run `./nodebb setup` again.'));
	}

	callback();
};

postgresModule.info = async function (db) {
	if (!db) {
		db = await connection.connect(nconf.get('postgres'));
	}
	postgresModule.pool = postgresModule.pool || db;
	const res = await db.query(`
		SELECT true "postgres",
		   current_setting('server_version') "version",
			 EXTRACT(EPOCH FROM NOW() - pg_postmaster_start_time()) * 1000 "uptime"
	`);
	return {
		...res.rows[0],
		raw: JSON.stringify(res.rows[0], null, 4),
	};
};

postgresModule.close = async function () {
	await postgresModule.pool.end();
};

require('./postgres/main')(postgresModule);
require('./postgres/hash')(postgresModule);
require('./postgres/sets')(postgresModule);
require('./postgres/sorted')(postgresModule);
require('./postgres/list')(postgresModule);
require('./postgres/transaction')(postgresModule);

require('../promisify')(postgresModule, ['client', 'sessionStore', 'pool', 'transaction']);
