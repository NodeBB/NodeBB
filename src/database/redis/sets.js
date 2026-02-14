'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

	module.setAdd = async function (key, value) {
		if (!Array.isArray(value)) {
			value = [value];
		}
		if (!value.length) {
			return;
		}
		await module.client.sadd(key, value);
	};

	module.setsAdd = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		const batch = module.client.batch();
		keys.forEach(k => batch.sadd(String(k), String(value)));
		await helpers.execBatch(batch);
	};

	module.setRemove = async function (key, value) {
		if (!Array.isArray(value)) {
			value = [value];
		}
		if (!Array.isArray(key)) {
			key = [key];
		}
		if (!value.length) {
			return;
		}

		const batch = module.client.batch();
		key.forEach(k => batch.srem(String(k), value));
		await helpers.execBatch(batch);
	};

	module.setsRemove = async function (keys, value) {
		const batch = module.client.batch();
		keys.forEach(k => batch.srem(String(k), value));
		await helpers.execBatch(batch);
	};

	module.isSetMember = async function (key, value) {
		const result = await module.client.sismember(key, value);
		return result === 1;
	};

	module.isSetMembers = async function (key, values) {
		const batch = module.client.batch();
		values.forEach(v => batch.sismember(String(key), String(v)));
		const results = await helpers.execBatch(batch);
		return results ? helpers.resultsToBool(results) : null;
	};

	module.isMemberOfSets = async function (sets, value) {
		const batch = module.client.batch();
		sets.forEach(s => batch.sismember(String(s), String(value)));
		const results = await helpers.execBatch(batch);
		return results ? helpers.resultsToBool(results) : null;
	};

	module.getSetMembers = async function (key) {
		return await module.client.smembers(key);
	};

	module.getSetsMembers = async function (keys) {
		const batch = module.client.batch();
		keys.forEach(k => batch.smembers(String(k)));
		return await helpers.execBatch(batch);
	};

	module.setCount = async function (key) {
		return await module.client.scard(key);
	};

	module.setsCount = async function (keys) {
		const batch = module.client.batch();
		keys.forEach(k => batch.scard(String(k)));
		return await helpers.execBatch(batch);
	};

	module.setRemoveRandom = async function (key) {
		return await module.client.spop(key);
	};

	return module;
};
