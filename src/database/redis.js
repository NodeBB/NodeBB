'use strict';

const async = require('async');
const winston = require('winston');
const nconf = require('nconf');
const semver = require('semver');
const session = require('express-session');

const connection = require('./redis/connection');

const redisModule = module.exports;

redisModule.questions = [
	{
		name: 'redis:host',
		description: 'Host IP or address of your Redis instance',
		default: nconf.get('redis:host') || '127.0.0.1',
	},
	{
		name: 'redis:port',
		description: 'Host port of your Redis instance',
		default: nconf.get('redis:port') || 6379,
	},
	{
		name: 'redis:password',
		description: 'Password of your Redis database',
		hidden: true,
		default: nconf.get('redis:password') || '',
		before: function (value) { value = value || nconf.get('redis:password') || ''; return value; },
	},
	{
		name: 'redis:database',
		description: 'Which database to use (0..n)',
		default: nconf.get('redis:database') || 0,
	},
];


redisModule.init = function (callback) {
	callback = callback || function () { };
	redisModule.client = connection.connect(nconf.get('redis'), function (err) {
		if (err) {
			winston.error('NodeBB could not connect to your Redis database. Redis returned the following error', err);
			return callback(err);
		}

		require('./redis/promisify')(redisModule.client);

		callback();
	});
};

redisModule.createSessionStore = function (options, callback) {
	const meta = require('../meta');
	const sessionStore = require('connect-redis')(session);
	const client = connection.connect(options);
	const store = new sessionStore({
		client: client,
		ttl: meta.getSessionTTLSeconds(),
	});

	if (typeof callback === 'function') {
		callback(null, store);
	}
};

redisModule.createIndices = function (callback) {
	setImmediate(callback);
};

redisModule.checkCompatibility = function (callback) {
	async.waterfall([
		function (next) {
			redisModule.info(redisModule.client, next);
		},
		function (info, next) {
			redisModule.checkCompatibilityVersion(info.redis_version, next);
		},
	], callback);
};

redisModule.checkCompatibilityVersion = function (version, callback) {
	if (semver.lt(version, '2.8.9')) {
		return callback(new Error('Your Redis version is not new enough to support NodeBB, please upgrade Redis to v2.8.9 or higher.'));
	}
	callback();
};

redisModule.close = function (callback) {
	callback = callback || function () {};
	redisModule.client.quit(function (err) {
		callback(err);
	});
};

redisModule.info = function (cxn, callback) {
	async.waterfall([
		function (next) {
			if (cxn) {
				return setImmediate(next, null, cxn);
			}
			connection.connect(nconf.get('redis'), next);
		},
		function (cxn, next) {
			redisModule.client = redisModule.client || cxn;

			cxn.info(next);
		},
		function (data, next) {
			var lines = data.toString().split('\r\n').sort();
			var redisData = {};
			lines.forEach(function (line) {
				var parts = line.split(':');
				if (parts[1]) {
					redisData[parts[0]] = parts[1];
				}
			});

			const keyInfo = redisData['db' + nconf.get('redis:database')];
			if (keyInfo) {
				redisData.keys = keyInfo.split(',')[0].replace('keys=', '');
				redisData.expires = keyInfo.split(',')[1].replace('expires=', '');
				redisData.avg_ttl = keyInfo.split(',')[2].replace('avg_ttl=', '');
			}

			redisData.instantaneous_input = (redisData.instantaneous_input_kbps / 1024).toFixed(3);
			redisData.instantaneous_output = (redisData.instantaneous_output_kbps / 1024).toFixed(3);

			redisData.total_net_input = (redisData.total_net_input_bytes / (1024 * 1024 * 1024)).toFixed(3);
			redisData.total_net_output = (redisData.total_net_output_bytes / (1024 * 1024 * 1024)).toFixed(3);

			redisData.used_memory_human = (redisData.used_memory / (1024 * 1024 * 1024)).toFixed(3);
			redisData.raw = JSON.stringify(redisData, null, 4);
			redisData.redis = true;

			next(null, redisData);
		},
	], callback);
};

redisModule.socketAdapter = function () {
	var redisAdapter = require('socket.io-redis');
	var pub = connection.connect(nconf.get('redis'));
	var sub = connection.connect(nconf.get('redis'));
	return redisAdapter({
		key: 'db:' + nconf.get('redis:database') + ':adapter_key',
		pubClient: pub,
		subClient: sub,
	});
};

require('./redis/main')(redisModule);
require('./redis/hash')(redisModule);
require('./redis/sets')(redisModule);
require('./redis/sorted')(redisModule);
require('./redis/list')(redisModule);
require('./redis/transaction')(redisModule);

redisModule.async = require('../promisify')(redisModule, ['client', 'sessionStore']);
