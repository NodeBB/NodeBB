'use strict';

const nconf = require('nconf');

const winston = require('winston');
const _ = require('lodash');

const connection = module.exports;

connection.getConnectionString = function (tigriscomp) {
	tigriscomp = tigriscomp || nconf.get('tigriscomp');
	let clientCredentials = '';
	const uri = tigriscomp.uri || '';
	if (tigriscomp.clientid && tigriscomp.clientsecret) {
		clientCredentials = `${tigriscomp.clientid}:${encodeURIComponent(tigriscomp.clientsecret)}@`;
	} else if (!uri.includes('@') || !uri.slice(uri.indexOf('://') + 3, uri.indexOf('@'))) {
		winston.warn('You have no tigriscomp clientid/clientsecret setup!');
	}

	// Sensible defaults for tigriscomp, if not set
	if (!tigriscomp.host) {
		tigriscomp.host = 'm1k.preview.tigrisdata.cloud';
	}
	if (!tigriscomp.port) {
		tigriscomp.port = 27018;
	}
	const dbName = tigriscomp.database;
	if (dbName === undefined || dbName === '') {
		winston.warn('You have no database name, using "nodebb"');
		tigriscomp.database = 'nodebb';
	}

	const hosts = tigriscomp.host.split(',');
	const ports = tigriscomp.port.toString().split(',');
	const servers = [];

	for (let i = 0; i < hosts.length; i += 1) {
		servers.push(`${hosts[i]}:${ports[i]}`);
	}

	// return uri || `mongodb://${clientCredentials}${servers.join()}/${tigriscomp.database}`;
	return uri || `mongodb://${clientCredentials}${servers.join()}/${tigriscomp.database}`;
};

connection.getConnectionOptions = function (tigriscomp) {
	tigriscomp = tigriscomp || nconf.get('tigriscomp');
	const connOptions = {
		maxPoolSize: 10,
		minPoolSize: 3,
		connectTimeoutMS: 90000,
	};

	return _.merge(connOptions, tigriscomp.options || {});
};

connection.connect = async function (options) {
	const tigriscompClient = require('mongodb').MongoClient;

	const connString = connection.getConnectionString(options);
	const connOptions = connection.getConnectionOptions(options);

	return await tigriscompClient.connect(connString, connOptions);
};
