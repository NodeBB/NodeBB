'use strict';

module.exports = function (module) {
	module.listPrepend = async function (key, value) {
		if (!key) {
			return;
		}
		await module.client.async.lpush(key, value);
	};

	module.listAppend = async function (key, value) {
		if (!key) {
			return;
		}
		await module.client.async.rpush(key, value);
	};

	module.listRemoveLast = async function (key) {
		if (!key) {
			return;
		}
		return await module.client.async.rpop(key);
	};

	module.listRemoveAll = async function (key, value) {
		if (!key) {
			return;
		}
		await module.client.async.lrem(key, 0, value);
	};

	module.listTrim = async function (key, start, stop) {
		if (!key) {
			return;
		}
		await module.client.async.ltrim(key, start, stop);
	};

	module.getListRange = async function (key, start, stop) {
		if (!key) {
			return;
		}
		return await module.client.async.lrange(key, start, stop);
	};

	module.listLength = async function (key) {
		return await module.client.async.llen(key);
	};
};
