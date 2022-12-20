'use strict';

import nconf from 'nconf';
import winston from 'winston';
import _ from 'lodash';
import { Pool } from 'pg';


const connection  = {} as any;

connection.getConnectionOptions = function (postgres) {
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

	const connOptions = {
		host: postgres.host,
		port: postgres.port,
		user: postgres.username,
		password: postgres.password,
		database: postgres.database,
		ssl: String(postgres.ssl) === 'true',
	};

	return _.merge(connOptions, postgres.options || {});
};

connection.connect = async function (options) {
	const connOptions = connection.getConnectionOptions(options);
	const db = new Pool(connOptions);
	await db.connect();
	return db;
};

import promisify from '../../promisify';
promisify(connection);
export default connection;