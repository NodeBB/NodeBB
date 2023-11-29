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
		if (!requestedFields || !requestedFields.length || requestedFields.includes(field)) {
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

function promisifySessionStoreMethod(method, sid) {
	return new Promise((resolve, reject) => {
		if (!primaryDB.sessionStore) {
			resolve(method === 'get' ? null : undefined);
			return;
		}

		primaryDB.sessionStore[method](sid, (err, result) => {
			if (err) reject(err);
			else resolve(method === 'get' ? result || null : undefined);
		});
	});
}

primaryDB.sessionStoreGet = function (sid) {
	return promisifySessionStoreMethod('get', sid);
};

primaryDB.sessionStoreDestroy = function (sid) {
	return promisifySessionStoreMethod('destroy', sid);
};

module.exports = primaryDB;
