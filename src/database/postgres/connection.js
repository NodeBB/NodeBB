'use strict';

const nconf = require('nconf');
const winston = require('winston');
const _ = require('lodash');

const connection = module.exports;

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

	var connOptions = {
		host: postgres.host,
		port: postgres.port,
		user: postgres.username,
		password: postgres.password,
		database: postgres.database,
		ssl: String(postgres.ssl) === 'true',
	};

	return _.merge(connOptions, postgres.options || {});
};

connection.connect = function (options, callback) {
	const Pool = require('pg').Pool;

	const connOptions = connection.getConnectionOptions(options);

	const db = new Pool(connOptions);

	db.connect(function (err) {
		callback(err, db);
	});
};
