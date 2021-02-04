'use strict';

const nconf = require('nconf');

const databaseName = nconf.get('database');
const winston = require('winston');

if (!databaseName) {
	winston.error(new Error('Database type not set! Run ./nodebb setup'));
	process.exit();
}

const primaryDB = require(`./${databaseName}`);

primaryDB.parseIntFields = function (data, intFields, requestedFields) {
	intFields.forEach((field) => {
		if (!requestedFields.length || requestedFields.includes(field)) {
			data[field] = parseInt(data[field], 10) || 0;
		}
	});
};

primaryDB.initSessionStore = async function () {
	const sessionStoreConfig = nconf.get('session_store') || nconf.get('redis') || nconf.get(databaseName);
	let sessionStoreDB = primaryDB;

	if (nconf.get('session_store')) {
		sessionStoreDB = require(`./${sessionStoreConfig.name}`);
	} else if (nconf.get('redis')) {
		// if redis is specified, use it as session store over others
		sessionStoreDB = require('./redis');
	}

	primaryDB.sessionStore = await sessionStoreDB.createSessionStore(sessionStoreConfig);
};

module.exports = primaryDB;
