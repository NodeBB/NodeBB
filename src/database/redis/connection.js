'use strict';

const nconf = require('nconf');
const redis = require('redis');
const winston = require('winston');
const _ = require('lodash');

const connection = module.exports;

connection.getConnectionOptions = function (redis) {
	redis = redis || nconf.get('redis');
	let connOptions = {};
	if (redis.password) {
		connOptions.auth_pass = redis.password;
	}

	connOptions = _.merge(connOptions, redis.options || {});
	return connOptions;
};

connection.connect = function (options, callback) {
	callback = callback || function () {};
	options = options || nconf.get('redis');
	var redis_socket_or_host = options.host;
	var cxn;
	var callbackCalled = false;

	const connOptions = connection.getConnectionOptions(options);

	if (redis_socket_or_host && redis_socket_or_host.indexOf('/') >= 0) {
		/* If redis.host contains a path name character, use the unix dom sock connection. ie, /tmp/redis.sock */
		cxn = redis.createClient(options.host, connOptions);
	} else {
		/* Else, connect over tcp/ip */
		cxn = redis.createClient(options.port, options.host, connOptions);
	}

	cxn.on('error', function (err) {
		winston.error(err.stack);
		if (!callbackCalled) {
			callbackCalled = true;
			callback(err);
		}
	});

	cxn.on('ready', function () {
		if (!callbackCalled) {
			callbackCalled = true;
			callback(null, cxn);
		}
	});

	if (options.password) {
		cxn.auth(options.password);
	}

	var dbIdx = parseInt(options.database, 10);
	if (dbIdx >= 0) {
		cxn.select(dbIdx, function (err) {
			if (err) {
				winston.error('NodeBB could not select Redis database. Redis returned the following error', err);
				throw err;
			}
		});
	} else {
		callbackCalled = true;
		return callback(new Error('[[error:no-database-selected]]'));
	}

	return cxn;
};
