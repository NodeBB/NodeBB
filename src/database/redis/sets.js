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
		await module.client.sAdd(key, value.map(String));
	};

	module.setsAdd = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length || !value) {
			return;
		}
		if (!Array.isArray(value)) {
			value = [value];
		}
		if (!value.length) {
			return;
		}
		const batch = module.client.batch();
		keys.forEach((k) => {
			value.forEach(v => batch.sAdd(String(k), String(v)));
		});
		await helpers.execBatch(batch);
	};

	module.setAddBulk = async function (data) {
		if (!data.length) {
			return;
		}

		const batch = module.client.batch();
		data.forEach(([key, member]) => batch.sAdd(String(key), String(member)));
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
		key.forEach(k => batch.sRem(String(k), value.map(String)));
		await helpers.execBatch(batch);
	};

	module.setsRemove = async function (keys, value) {
		const batch = module.client.batch();
		keys.forEach(k => batch.sRem(String(k), String(value)));
		await helpers.execBatch(batch);
	};

	module.isSetMember = async function (key, value) {
		const result = await module.client.sIsMember(key, String(value));
		return result === 1;
	};

	module.isSetMembers = async function (key, values) {
		const batch = module.client.batch();
		values.forEach(v => batch.sIsMember(String(key), String(v)));
		const results = await helpers.execBatch(batch);
		return results ? helpers.resultsToBool(results) : null;
	};

	module.isMemberOfSets = async function (sets, value) {
		const batch = module.client.batch();
		sets.forEach(s => batch.sIsMember(String(s), String(value)));
		const results = await helpers.execBatch(batch);
		return results ? helpers.resultsToBool(results) : null;
	};

	module.getSetMembers = async function (key) {
		return await module.client.sMembers(key);
	};

	module.getSetsMembers = async function (keys) {
		const batch = module.client.batch();
		keys.forEach(k => batch.sMembers(String(k)));
		return await helpers.execBatch(batch);
	};

	module.setCount = async function (key) {
		return await module.client.sCard(key);
	};

	module.setsCount = async function (keys) {
		const batch = module.client.batch();
		keys.forEach(k => batch.sCard(String(k)));
		return await helpers.execBatch(batch);
	};

	module.setRemoveRandom = async function (key) {
		return await module.client.sPop(key);
	};

	return module;
};
