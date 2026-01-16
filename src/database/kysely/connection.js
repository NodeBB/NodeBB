'use strict';

const nconf = require('nconf');
const winston = require('winston');

const connection = module.exports;

connection.getDialect = function (options) {
	options = options || nconf.get('kysely') || {};
	return options.dialect || 'mysql';
};

connection.getConnectionOptions = function (options) {
	options = options || nconf.get('kysely') || {};
	const dialect = connection.getDialect(options);
	
	const connOptions = {
		dialect: dialect,
	};
	
	if (dialect === 'mysql') {
		// MySQL connection options
		connOptions.host = options.host || '127.0.0.1';
		connOptions.port = parseInt(options.port, 10) || 3306;
		connOptions.user = options.username || options.user || '';
		connOptions.password = options.password || '';
		connOptions.database = options.database || 'nodebb';
		connOptions.connectionLimit = options.connectionLimit || 20;
		connOptions.connectTimeout = options.connectTimeout || 90000;
		
		if (options.ssl) {
			connOptions.ssl = typeof options.ssl === 'object' ? options.ssl : { rejectUnauthorized: false };
		}
	} else if (dialect === 'postgres') {
		// PostgreSQL connection options
		connOptions.host = options.host || '127.0.0.1';
		connOptions.port = parseInt(options.port, 10) || 5432;
		connOptions.user = options.username || options.user || '';
		connOptions.password = options.password || '';
		connOptions.database = options.database || 'nodebb';
		connOptions.max = options.max || 20;
		connOptions.connectionTimeoutMillis = options.connectionTimeoutMillis || 90000;
		
		if (options.ssl) {
			const fs = require('fs');
			if (typeof options.ssl === 'object') {
				connOptions.ssl = {
					rejectUnauthorized: options.ssl.rejectUnauthorized,
				};
				['ca', 'key', 'cert'].forEach((prop) => {
					if (options.ssl[prop]) {
						connOptions.ssl[prop] = fs.readFileSync(options.ssl[prop]).toString();
					}
				});
			} else {
				connOptions.ssl = { rejectUnauthorized: false };
			}
		}
	} else if (dialect === 'sqlite') {
		// SQLite connection options
		connOptions.filename = options.filename || options.database || ':memory:';
	}
	
	return connOptions;
};

connection.createKyselyInstance = async function (options) {
	const { Kysely, MysqlDialect, PostgresDialect, SqliteDialect } = require('kysely');
	
	const connOptions = connection.getConnectionOptions(options);
	const {dialect} = connOptions;
	
	let kyselyDialect;
	
	if (dialect === 'mysql') {
		const mysql2 = require('mysql2');
		const pool = mysql2.createPool({
			host: connOptions.host,
			port: connOptions.port,
			user: connOptions.user,
			password: connOptions.password,
			database: connOptions.database,
			connectionLimit: connOptions.connectionLimit,
			connectTimeout: connOptions.connectTimeout,
			ssl: connOptions.ssl,
		});
		
		kyselyDialect = new MysqlDialect({
			pool: pool.promise(),
		});
	} else if (dialect === 'postgres') {
		const { Pool } = require('pg');
		const pool = new Pool({
			host: connOptions.host,
			port: connOptions.port,
			user: connOptions.user,
			password: connOptions.password,
			database: connOptions.database,
			max: connOptions.max,
			connectionTimeoutMillis: connOptions.connectionTimeoutMillis,
			ssl: connOptions.ssl,
		});
		
		kyselyDialect = new PostgresDialect({
			pool: pool,
		});
	} else if (dialect === 'sqlite') {
		const Database = require('better-sqlite3');
		const database = new Database(connOptions.filename);
		database.pragma('journal_mode = WAL');
		database.pragma('foreign_keys = ON');
		
		kyselyDialect = new SqliteDialect({
			database: database,
		});
	} else {
		throw new Error(`Unsupported database dialect: ${dialect}`);
	}
	
	const db = new Kysely({
		dialect: kyselyDialect,
	});
	
	// Test the connection
	try {
		if (dialect === 'mysql') {
			await db.selectFrom('information_schema.tables').select('table_name').limit(1).execute();
		} else if (dialect === 'postgres') {
			await db.selectFrom('pg_catalog.pg_tables').select('tablename').limit(1).execute();
		} else if (dialect === 'sqlite') {
			await db.selectFrom('sqlite_master').select('name').limit(1).execute();
		}
	} catch (err) {
		winston.error(`Failed to connect to database: ${err.message}`);
		throw err;
	}
	
	return db;
};

connection.connect = async function (options) {
	return await connection.createKyselyInstance(options);
};

require('../../promisify')(connection);