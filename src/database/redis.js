'use strict';

const nconf = require('nconf');
const semver = require('semver');

const connection = require('./redis/connection');

const redisModule = module.exports;

redisModule.questions = [
	{
		name: 'redis:host',
		description: 'Host IP or address of your Redis instance',
		default: nconf.get('redis:host') || nconf.get('defaults:redis:host') || '127.0.0.1',
	},
	{
		name: 'redis:port',
		description: 'Host port of your Redis instance',
		default: nconf.get('redis:port') || nconf.get('defaults:redis:port') || 6379,
	},
	{
		name: 'redis:password',
		description: 'Password of your Redis database',
		hidden: true,
		default: nconf.get('redis:password') || nconf.get('defaults:redis:password') || '',
		before: function (value) { value = value || nconf.get('redis:password') || ''; return value; },
	},
	{
		name: 'redis:database',
		description: 'Which database to use (0..n)',
		default: nconf.get('redis:database') || nconf.get('defaults:redis:database') || 0,
	},
];


redisModule.init = async function (opts) {
	redisModule.client = await connection.connect(opts || nconf.get('redis'));
};

redisModule.createSessionStore = async function (options) {
	const meta = require('../meta');
	const sessionStore = require('connect-redis').default;
	const client = await connection.connect(options);
	const store = new sessionStore({
		client: client,
		ttl: meta.getSessionTTLSeconds(),
	});
	return store;
};

redisModule.checkCompatibility = async function () {
	const info = await redisModule.info(redisModule.client);
	await redisModule.checkCompatibilityVersion(info.redis_version);
};

redisModule.checkCompatibilityVersion = function (version, callback) {
	if (semver.lt(version, '2.8.9')) {
		callback(new Error('Your Redis version is not new enough to support NodeBB, please upgrade Redis to v2.8.9 or higher.'));
	}
	callback();
};

redisModule.close = async function () {
	await redisModule.client.quit();
	if (redisModule.objectCache) {
		redisModule.objectCache.reset();
	}
};

redisModule.info = async function (cxn) {
	if (!cxn) {
		cxn = await connection.connect(nconf.get('redis'));
	}
	redisModule.client = redisModule.client || cxn;
	const data = await cxn.info();
	const lines = data.toString().split('\r\n').sort();
	const redisData = {};
	lines.forEach((line) => {
		const parts = line.split(':');
		if (parts[1]) {
			redisData[parts[0]] = parts[1];
		}
	});

	const keyInfo = redisData[`db${nconf.get('redis:database')}`];
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

redisModule.socketAdapter = async function () {
	const redisAdapter = require('@socket.io/redis-adapter');
	const pub = await connection.connect(nconf.get('redis'));
	const sub = await connection.connect(nconf.get('redis'));
	return redisAdapter(pub, sub, {
		key: `db:${nconf.get('redis:database')}:adapter_key`,
	});
};

require('./redis/main')(redisModule);
require('./redis/hash')(redisModule);
require('./redis/sets')(redisModule);
require('./redis/sorted')(redisModule);
require('./redis/list')(redisModule);
require('./redis/transaction')(redisModule);

require('../promisify')(redisModule, ['client', 'sessionStore']);
