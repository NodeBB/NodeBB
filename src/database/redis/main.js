'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

	module.flushdb = async function () {
		await module.client.send_command('flushdb', []);
	};

	module.emptydb = async function () {
		await module.flushdb();
		module.objectCache.reset();
	};

	module.exists = async function (key) {
		if (Array.isArray(key)) {
			if (!key.length) {
				return [];
			}
			const batch = module.client.batch();
			key.forEach(key => batch.exists(key));
			const data = await helpers.execBatch(batch);
			return data.map(exists => exists === 1);
		}
		const exists = await module.client.exists(key);
		return exists === 1;
	};

	module.scan = async function (params) {
		let cursor = '0';
		let returnData = [];
		const seen = Object.create(null);
		do {
			/* eslint-disable no-await-in-loop */
			const res = await module.client.scan(cursor, 'MATCH', params.match, 'COUNT', 10000);
			cursor = res[0];
			const values = res[1].filter((value) => {
				const isSeen = !!seen[value];
				if (!isSeen) {
					seen[value] = 1;
				}
				return !isSeen;
			});
			returnData = returnData.concat(values);
		} while (cursor !== '0');
		return returnData;
	};

	module.delete = async function (key) {
		await module.client.del(key);
		module.objectCache.del(key);
	};

	module.deleteAll = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		await module.client.del(keys);
		module.objectCache.del(keys);
	};

	module.get = async function (key) {
		return await module.client.get(key);
	};

	module.mget = async function (keys) {
		if (!keys || !Array.isArray(keys) || !keys.length) {
			return [];
		}
		return await module.client.mget(keys);
	};

	module.set = async function (key, value) {
		await module.client.set(key, value);
	};

	module.increment = async function (key) {
		return await module.client.incr(key);
	};

	module.rename = async function (oldKey, newKey) {
		try {
			await module.client.rename(oldKey, newKey);
		} catch (err) {
			if (err && err.message !== 'ERR no such key') {
				throw err;
			}
		}

		module.objectCache.del([oldKey, newKey]);
	};

	module.type = async function (key) {
		const type = await module.client.type(key);
		return type !== 'none' ? type : null;
	};

	module.expire = async function (key, seconds) {
		await module.client.expire(key, seconds);
	};

	module.expireAt = async function (key, timestamp) {
		await module.client.expireat(key, timestamp);
	};

	module.pexpire = async function (key, ms) {
		await module.client.pexpire(key, ms);
	};

	module.pexpireAt = async function (key, timestamp) {
		await module.client.pexpireat(key, timestamp);
	};

	module.ttl = async function (key) {
		return await module.client.ttl(key);
	};

	module.pttl = async function (key) {
		return await module.client.pttl(key);
	};
};
