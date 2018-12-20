'use strict';

var winston = require('winston');
var async = require('async');
var nconf = require('nconf');
var session = require('express-session');
var _ = require('lodash');
var semver = require('semver');
var dbNamespace = require('continuation-local-storage').createNamespace('postgres');


var postgresModule = module.exports;

postgresModule.questions = [
	{
		name: 'postgres:host',
		description: 'Host IP or address of your PostgreSQL instance',
		default: nconf.get('postgres:host') || '127.0.0.1',
	},
	{
		name: 'postgres:port',
		description: 'Host port of your PostgreSQL instance',
		default: nconf.get('postgres:port') || 5432,
	},
	{
		name: 'postgres:username',
		description: 'PostgreSQL username',
		default: nconf.get('postgres:username') || '',
	},
	{
		name: 'postgres:password',
		description: 'Password of your PostgreSQL database',
		hidden: true,
		default: nconf.get('postgres:password') || '',
		before: function (value) { value = value || nconf.get('postgres:password') || ''; return value; },
	},
	{
		name: 'postgres:database',
		description: 'PostgreSQL database name',
		default: nconf.get('postgres:database') || 'nodebb',
	},
];

postgresModule.helpers = postgresModule.helpers || {};
postgresModule.helpers.postgres = require('./postgres/helpers');

postgresModule.getConnectionOptions = function (postgres) {
	postgres = postgres || nconf.get('postgres');
	// Sensible defaults for PostgreSQL, if not set
	if (!postgres.host) {
		postgres.host = '127.0.0.1';
	}
	if (!postgres.port) {
		postgres.port = 5432;
	}
	const dbName = postgres.database;
	if (dbName === undefined || dbName === '') {
		winston.warn('You have no database name, using "nodebb"');
		postgres.database = 'nodebb';
	}

	var connOptions = {
		host: postgres.host,
		port: postgres.port,
		user: postgres.username,
		password: postgres.password,
		database: postgres.database,
	};

	return _.merge(connOptions, postgres.options || {});
};

postgresModule.init = function (callback) {
	callback = callback || function () { };

	var Pool = require('pg').Pool;

	var connOptions = postgresModule.getConnectionOptions();

	const db = new Pool(connOptions);

	db.on('connect', function (client) {
		var realQuery = client.query;
		client.query = function () {
			var args = Array.prototype.slice.call(arguments, 0);
			if (dbNamespace.active && typeof args[args.length - 1] === 'function') {
				args[args.length - 1] = dbNamespace.bind(args[args.length - 1]);
			}
			return realQuery.apply(client, args);
		};
	});

	db.connect(function (err, client, release) {
		if (err) {
			winston.error('NodeBB could not connect to your PostgreSQL database. PostgreSQL returned the following error: ' + err.message);
			return callback(err);
		}

		postgresModule.pool = db;
		Object.defineProperty(postgresModule, 'client', {
			get: function () {
				return (dbNamespace.active && dbNamespace.get('db')) || db;
			},
			configurable: true,
		});

		var wrappedDB = {
			connect: function () {
				return postgresModule.pool.connect.apply(postgresModule.pool, arguments);
			},
			query: function () {
				return postgresModule.client.query.apply(postgresModule.client, arguments);
			},
		};

		checkUpgrade(client, function (err) {
			release();
			if (err) {
				return callback(err);
			}

			require('./postgres/main')(wrappedDB, postgresModule);
			require('./postgres/hash')(wrappedDB, postgresModule);
			require('./postgres/sets')(wrappedDB, postgresModule);
			require('./postgres/sorted')(wrappedDB, postgresModule);
			require('./postgres/list')(wrappedDB, postgresModule);
			require('./postgres/transaction')(db, dbNamespace, postgresModule);

			postgresModule.async = require('../promisify')(postgresModule, ['client', 'sessionStore', 'pool']);

			callback();
		});
	});
};

postgresModule.connect = function (options, callback) {
	var Pool = require('pg').Pool;

	var connOptions = postgresModule.getConnectionOptions(options);

	const db = new Pool(connOptions);

	db.on('connect', function (client) {
		var realQuery = client.query;
		client.query = function () {
			var args = Array.prototype.slice.call(arguments, 0);
			if (dbNamespace.active && typeof args[args.length - 1] === 'function') {
				args[args.length - 1] = dbNamespace.bind(args[args.length - 1]);
			}
			return realQuery.apply(client, args);
		};
	});

	db.connect(function (err) {
		callback(err, db);
	});
};

function checkUpgrade(client, callback) {
	client.query(`
SELECT EXISTS(SELECT *
                FROM "information_schema"."columns"
               WHERE "table_schema" = 'public'
                 AND "table_name" = 'objects'
                 AND "column_name" = 'data') a,
       EXISTS(SELECT *
                FROM "information_schema"."columns"
               WHERE "table_schema" = 'public'
                 AND "table_name" = 'legacy_hash'
                 AND "column_name" = '_key') b`, function (err, res) {
		if (err) {
			return callback(err);
		}

		if (res.rows[0].b) {
			return callback(null);
		}

		var query = client.query.bind(client);

		async.series([
			async.apply(query, `BEGIN`),
			async.apply(query, `
CREATE TYPE LEGACY_OBJECT_TYPE AS ENUM (
	'hash', 'zset', 'set', 'list', 'string'
)`),
			async.apply(query, `
CREATE TABLE "legacy_object" (
	"_key" TEXT NOT NULL
		PRIMARY KEY,
	"type" LEGACY_OBJECT_TYPE NOT NULL,
	"expireAt" TIMESTAMPTZ DEFAULT NULL,
	UNIQUE ( "_key", "type" )
)`),
			async.apply(query, `
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
)`),
			async.apply(query, `
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
)`),
			async.apply(query, `
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
)`),
			async.apply(query, `
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
)`),
			async.apply(query, `
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
)`),
			function (next) {
				if (!res.rows[0].a) {
					return next();
				}
				async.series([
					async.apply(query, `
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
  FROM "objects"`),
					async.apply(query, `
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
       END`),
					async.apply(query, `
INSERT INTO "legacy_zset" ("_key", "value", "score")
SELECT "data"->>'_key',
       "data"->>'value',
       ("data"->>'score')::NUMERIC
  FROM "objects"
 WHERE (SELECT COUNT(*)
          FROM jsonb_object_keys("data" - 'expireAt')) = 3
   AND ("data" ? 'value')
   AND ("data" ? 'score')`),
					async.apply(query, `
INSERT INTO "legacy_set" ("_key", "member")
SELECT "data"->>'_key',
       jsonb_array_elements_text("data"->'members')
  FROM "objects"
 WHERE (SELECT COUNT(*)
          FROM jsonb_object_keys("data" - 'expireAt')) = 2
   AND ("data" ? 'members')`),
					async.apply(query, `
INSERT INTO "legacy_list" ("_key", "array")
SELECT "data"->>'_key',
       ARRAY(SELECT t
               FROM jsonb_array_elements_text("data"->'list') WITH ORDINALITY l(t, i)
              ORDER BY i ASC)
  FROM "objects"
 WHERE (SELECT COUNT(*)
          FROM jsonb_object_keys("data" - 'expireAt')) = 2
   AND ("data" ? 'array')`),
					async.apply(query, `
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
     OR ("data" ? 'data'))`),
					async.apply(query, `DROP TABLE "objects" CASCADE`),
					async.apply(query, `DROP FUNCTION "fun__objects__expireAt"() CASCADE`),
				], next);
			},
			async.apply(query, `
CREATE VIEW "legacy_object_live" AS
SELECT "_key", "type"
  FROM "legacy_object"
 WHERE "expireAt" IS NULL
    OR "expireAt" > CURRENT_TIMESTAMP`),
		], function (err) {
			query(err ? `ROLLBACK` : `COMMIT`, function (err1) {
				callback(err1 || err);
			});
		});
	});
}

postgresModule.createSessionStore = function (options, callback) {
	var meta = require('../meta');

	function done(db) {
		const sessionStore = require('connect-pg-simple')(session);
		const store = new sessionStore({
			pool: db,
			ttl: meta.getSessionTTLSeconds(),
			pruneSessionInterval: nconf.get('isPrimary') === 'true' ? 60 : false,
		});
		callback(null, store);
	}

	postgresModule.connect(options, function (err, db) {
		if (err) {
			return callback(err);
		}
		if (nconf.get('isPrimary') !== 'true') {
			return done(db);
		}
		db.query(`
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
	CLUSTER ON "session_expire_idx";`, function (err) {
			if (err) {
				return callback(err);
			}

			done(db);
		});
	});
};

postgresModule.createIndices = function (callback) {
	if (!postgresModule.pool) {
		winston.warn('[database/createIndices] database not initialized');
		return callback();
	}

	var query = postgresModule.pool.query.bind(postgresModule.pool);

	winston.info('[database] Checking database indices.');
	async.series([
		async.apply(query, `CREATE INDEX IF NOT EXISTS "idx__legacy_zset__key__score" ON "legacy_zset"("_key" ASC, "score" DESC)`),
		async.apply(query, `CREATE INDEX IF NOT EXISTS "idx__legacy_object__expireAt" ON "legacy_object"("expireAt" ASC)`),
	], function (err) {
		if (err) {
			winston.error('Error creating index ' + err.message);
			return callback(err);
		}
		winston.info('[database] Checking database indices done!');
		callback();
	});
};

postgresModule.checkCompatibility = function (callback) {
	var postgresPkg = require('pg/package.json');
	postgresModule.checkCompatibilityVersion(postgresPkg.version, callback);
};

postgresModule.checkCompatibilityVersion = function (version, callback) {
	if (semver.lt(version, '7.0.0')) {
		return callback(new Error('The `pg` package is out-of-date, please run `./nodebb setup` again.'));
	}

	callback();
};

postgresModule.info = function (db, callback) {
	async.waterfall([
		function (next) {
			if (db) {
				setImmediate(next, null, db);
			} else {
				postgresModule.connect(nconf.get('postgres'), next);
			}
		},
		function (db, next) {
			postgresModule.pool = postgresModule.pool || db;

			db.query(`
			SELECT true "postgres",
				   current_setting('server_version') "version",
				   EXTRACT(EPOCH FROM NOW() - pg_postmaster_start_time()) * 1000 "uptime"`, next);
		},
		function (res, next) {
			next(null, res.rows[0]);
		},
	], callback);
};

postgresModule.close = function (callback) {
	callback = callback || function () {};
	postgresModule.pool.end(callback);
};

postgresModule.socketAdapter = function () {
	var postgresAdapter = require('socket.io-adapter-postgres');
	return postgresAdapter(postgresModule.getConnectionOptions(), {
		pubClient: postgresModule.pool,
	});
};
