'use strict';

const nconf = require('nconf');
const Redis = require('ioredis');
const winston = require('winston');

const connection = module.exports;

connection.connect = async function (options) {
	return new Promise((resolve, reject) => {
		options = options || nconf.get('redis');
		const redis_socket_or_host = options.host;

		let cxn;
		if (options.cluster) {
			cxn = new Redis.Cluster(options.cluster, options.options);
		} else if (options.sentinels) {
			cxn = new Redis({
				sentinels: options.sentinels,
				...options.options,
			});
		} else if (redis_socket_or_host && String(redis_socket_or_host).indexOf('/') >= 0) {
			// If redis.host contains a path name character, use the unix dom sock connection. ie, /tmp/redis.sock
			cxn = new Redis({
				...options.options,
				path: redis_socket_or_host,
				password: options.password,
				db: options.database,
			});
		} else {
			// Else, connect over tcp/ip
			cxn = new Redis({
				...options.options,
				host: redis_socket_or_host,
				port: options.port,
				password: options.password,
				db: options.database,
			});
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
			// back-compat with node_redis
			cxn.batch = cxn.pipeline;
			resolve(cxn);
		});

		if (options.password) {
			cxn.auth(options.password);
		}
	});
};

require('../../promisify')(connection);
