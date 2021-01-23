'use strict';

const nconf = require('nconf');
const semver = require('semver');
const util = require('util');
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


redisModule.init = async function () {
	redisModule.client = await connection.connect(nconf.get('redis'));
	require('./redis/promisify')(redisModule.client);
};

redisModule.createSessionStore = async function (options) {
	const meta = require('../meta');
	const sessionStore = require('connect-redis')(session);
	const client = await connection.connect(options);
	const store = new sessionStore({
		client: client,
		ttl: meta.getSessionTTLSeconds(),
	});
	return store;
};

redisModule.checkCompatibility = async function () {
	const info = await redisModule.info(redisModule.client);
	redisModule.checkCompatibilityVersion(info.redis_version);
};

redisModule.checkCompatibilityVersion = function (version) {
	if (semver.lt(version, '2.8.9')) {
		throw new Error('Your Redis version is not new enough to support NodeBB, please upgrade Redis to v2.8.9 or higher.');
	}
};

redisModule.close = async function () {
	await redisModule.client.async.quit();
};

redisModule.info = async function (cxn) {
	if (!cxn) {
		cxn = await connection.connect(nconf.get('redis'));
	}
	redisModule.client = redisModule.client || cxn;
	const infoAsync = util.promisify(cb => cxn.info(cb));
	const data = await infoAsync();
	const lines = data.toString().split('\r\n').sort();
	const redisData = {};
	lines.forEach(function (line) {
		const parts = line.split(':');
		if (parts[1]) {
			redisData[parts[0]] = parts[1];
		}
	});

	const keyInfo = redisData['db' + nconf.get('redis:database')];
	if (keyInfo) {
		const split = keyInfo.split(',');
		redisData.keys = (split[0] || '').replace('keys=', '');
		redisData.expires = (split[1] || '').replace('expires=', '');
		redisData.avg_ttl = (split[2] || '').replace('avg_ttl=', '');
	}

	redisData.instantaneous_input = (redisData.instantaneous_input_kbps / 1024).toFixed(3);
	redisData.instantaneous_output = (redisData.instantaneous_output_kbps / 1024).toFixed(3);

	redisData.total_net_input = (redisData.total_net_input_bytes / (1024 * 1024 * 1024)).toFixed(3);
	redisData.total_net_output = (redisData.total_net_output_bytes / (1024 * 1024 * 1024)).toFixed(3);

	redisData.used_memory_human = (redisData.used_memory / (1024 * 1024 * 1024)).toFixed(3);
	redisData.raw = JSON.stringify(redisData, null, 4);
	redisData.redis = true;
	return redisData;
};

redisModule.socketAdapter = function () {
	const redisAdapter = require('socket.io-redis');
	const pub = connection.connect(nconf.get('redis'));
	const sub = connection.connect(nconf.get('redis'));
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

require('../promisify')(redisModule, ['client', 'sessionStore']);
