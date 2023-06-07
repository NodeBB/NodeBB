'use strict';

const nconf = require('nconf');

const winston = require('winston');

const connection = module.exports;

connection.getConnectionString = function (tigris) {
	tigris = tigris || nconf.get('tigris');

	const connOption = {};

	if (tigris.clientid && tigris.clientsecret) {
		connOption.clientId = tigris.clientid;
		connOption.clientSecret = tigris.clientsecret;
	} else {
		winston.warn('You have no tigris clientid/clientsecret setup!');
	}

	// Sensible defaults for tigris, if not set
	connOption.serverUrl = tigris.host || 'api.preview.tigrisdata.cloud';
	connOption.branch = tigris.branch || 'main';

	let dbName = tigris.database;
	if (dbName === undefined || dbName === '') {
		winston.warn('You have no database name, using "nodebb"');
		dbName = 'nodebb';
	}
	connOption.projectName = dbName;

	return connOption;
};


connection.connect = async function (options) {
	const { Tigris } = require('@tigrisdata/core');

	const connConfig = connection.getConnectionString(options);
	const tigrisClient = new Tigris(connConfig);
	await tigrisClient.getDatabase().initializeBranch();
	return tigrisClient;
};
