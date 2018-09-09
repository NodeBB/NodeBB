'use strict';

var winston = require('winston');
var async = require('async');
var nconf = require('nconf');
var session = require('express-session');
var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var semver = require('semver');
var dbNamespace = require('continuation-local-storage').createNamespace('postgres');
var db;
var flushExpiredInterval;

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

postgresModule.getConnectionOptions = function () {
	// Sensible defaults for PostgreSQL, if not set
	if (!nconf.get('postgres:host')) {
		nconf.set('postgres:host', '127.0.0.1');
	}
	if (!nconf.get('postgres:port')) {
		nconf.set('postgres:port', 5432);
	}
	if (!nconf.get('postgres:database')) {
		nconf.set('postgres:database', 'nodebb');
	}

	var connOptions = {
		host: nconf.get('postgres:host'),
		port: nconf.get('postgres:port'),
		user: nconf.get('postgres:username'),
		password: nconf.get('postgres:password'),
		database: nconf.get('postgres:database'),
	};

	return _.merge(connOptions, nconf.get('postgres:options') || {});
};

postgresModule.init = function (callback) {
	callback = callback || function () { };

	var Pool = require('pg').Pool;

	var connOptions = postgresModule.getConnectionOptions();

	db = new Pool(connOptions);

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
		release();

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

		require('./postgres/main')(wrappedDB, postgresModule);
		require('./postgres/hash')(wrappedDB, postgresModule);
		require('./postgres/sets')(wrappedDB, postgresModule);
		require('./postgres/sorted')(wrappedDB, postgresModule);
		require('./postgres/list')(wrappedDB, postgresModule);
		require('./postgres/transaction')(db, dbNamespace, postgresModule);

		postgresModule.async = require('../promisify')(postgresModule, ['client', 'sessionStore', 'pool']);

		if (nconf.get('isPrimary') === 'true') {
			flushExpiredInterval = setInterval(function () {
				db.query(`SELECT "object_flushExpired"()`);
			}, 60 * 1000);
		}

		callback();
	});
};

postgresModule.initSessionStore = function (callback) {
	var meta = require('../meta');
	var sessionStore;

	var ttl = meta.getSessionTTLSeconds();

	if (nconf.get('redis')) {
		sessionStore = require('connect-redis')(session);
		var rdb = require('./redis');
		rdb.client = rdb.connect();

		postgresModule.sessionStore = new sessionStore({
			client: rdb.client,
			ttl: ttl,
		});

		return callback();
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

		sessionStore = require('connect-pg-simple')(session);
		postgresModule.sessionStore = new sessionStore({
			pool: db,
			ttl: ttl,
			pruneSessionInterval: nconf.get('isPrimary') === 'true' ? 60 : false,
		});

		callback();
	});
};

postgresModule.createIndices = function (callback) {
	var scripts = ['0000.legacy.sql', '0001.functions.sql'];
	async.eachSeries(scripts, function (name, next) {
		fs.readFile(path.join(__dirname, 'postgres', 'schema', name), 'utf8', function (err, data) {
			if (err) {
				return next(err);
			}

			db.query(data, function (err1) {
				next(err1);
			});
		});
	}, callback);
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
	if (!db) {
		return callback();
	}

	db.query(`
SELECT true "postgres",
       current_setting('server_version') "version",
       EXTRACT(EPOCH FROM NOW() - pg_postmaster_start_time()) * 1000 "uptime"`, function (err, res) {
		if (err) {
			return callback(err);
		}
		callback(null, res.rows[0]);
	});
};

postgresModule.close = function (callback) {
	callback = callback || function () {};
	clearInterval(flushExpiredInterval);
	db.end(callback);
};

postgresModule.socketAdapter = function () {
	var postgresAdapter = require('socket.io-adapter-postgres');
	return postgresAdapter(postgresModule.getConnectionOptions(), {
		pubClient: postgresModule.pool,
	});
};
