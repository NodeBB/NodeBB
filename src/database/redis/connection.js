'use strict';

const nconf = require('nconf');
const redis = require('redis');
const winston = require('winston');
const _ = require('lodash');

const connection = module.exports;

connection.getConnectionOptions = function (redis) {
	redis = redis || nconf.get('redis');
	const connOptions = {};
	if (redis.password) {
		connOptions.auth_pass = redis.password;
	}
	if (redis.hasOwnProperty('database')) {
		connOptions.db = redis.database;
	}
	return _.merge(connOptions, redis.options || {});
};

connection.connect = async function (options) {
	return new Promise((resolve, reject) => {
		options = options || nconf.get('redis');
		const redis_socket_or_host = options.host;
		const connOptions = connection.getConnectionOptions(options);

		let cxn;
		if (redis_socket_or_host && String(redis_socket_or_host).indexOf('/') >= 0) {
			/* If redis.host contains a path name character, use the unix dom sock connection. ie, /tmp/redis.sock */
			cxn = redis.createClient(options.host, connOptions);
		} else {
			/* Else, connect over tcp/ip */
			cxn = redis.createClient(options.port, options.host, connOptions);
		}

		const dbIdx = parseInt(options.database, 10);
		if (!(dbIdx >= 0)) {
			throw new Error('[[error:no-database-selected]]');
		}

		cxn.on('error', (err) => {
			winston.error(err.stack);
			reject(err);
		});
		cxn.on('ready', () => {
			resolve(cxn);
		});

		if (options.password) {
			cxn.auth(options.password);
		}
	});
};

require('../../promisify')(connection);
