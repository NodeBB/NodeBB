'use strict';

module.exports = function (module) {
	var helpers = require('./helpers');

	module.flushdb = async function () {
		await module.client.async.send_command('flushdb', []);
	};

	module.emptydb = async function () {
		await module.flushdb();
		module.objectCache.resetObjectCache();
	};

	module.exists = async function (key) {
		if (Array.isArray(key)) {
			const batch = module.client.batch();
			key.forEach(key => batch.exists(key));
			const data = await helpers.execBatch(batch);
			return data.map(exists => exists === 1);
		}
		const exists = await module.client.async.exists(key);
		return exists === 1;
	};

	module.scan = async function (params) {
		let cursor = '0';
		let returnData = [];
		const seen = {};
		do {
			/* eslint-disable no-await-in-loop */
			const res = await module.client.async.scan(cursor, 'MATCH', params.match, 'COUNT', 10000);
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
		await module.client.async.del(key);
		module.objectCache.delObjectCache(key);
	};

	module.deleteAll = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		await module.client.async.del(keys);
		module.objectCache.delObjectCache(keys);
	};

	module.get = async function (key) {
		return await module.client.async.get(key);
	};

	module.set = async function (key, value) {
		await module.client.async.set(key, value);
	};

	module.increment = async function (key) {
		return await module.client.async.incr(key);
	};

	module.rename = async function (oldKey, newKey) {
		try {
			await module.client.async.rename(oldKey, newKey);
		} catch (err) {
			if (err && err.message !== 'ERR no such key') {
				throw err;
			}
		}

		module.objectCache.delObjectCache([oldKey, newKey]);
	};

	module.type = async function (key) {
		const type = await module.client.async.type(key);
		return type !== 'none' ? type : null;
	};

	module.expire = async function (key, seconds) {
		await module.client.async.expire(key, seconds);
	};

	module.expireAt = async function (key, timestamp) {
		await module.client.async.expireat(key, timestamp);
	};

	module.pexpire = async function (key, ms) {
		await module.client.async.pexpire(key, ms);
	};

	module.pexpireAt = async function (key, timestamp) {
		await module.client.async.pexpireat(key, timestamp);
	};
};
