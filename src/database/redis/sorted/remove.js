
'use strict';

module.exports = function (module) {
	const helpers = require('../helpers');

	module.sortedSetRemove = async function (key, value) {
		if (!key) {
			return;
		}
		const isValueArray = Array.isArray(value);
		if (!value || (isValueArray && !value.length)) {
			return;
		}
		if (!isValueArray) {
			value = [value];
		}

		if (Array.isArray(key)) {
			const batch = module.client.batch();
			key.forEach(k => batch.zRem(k, value.map(String)));
			await helpers.execBatch(batch);
		} else {
			await module.client.zRem(key, value.map(String));
		}
	};

	module.sortedSetsRemove = async function (keys, value) {
		await module.sortedSetRemove(keys, value);
	};

	module.sortedSetsRemoveRangeByScore = async function (keys, min, max) {
		const batch = module.client.batch();
		keys.forEach(k => batch.zRemRangeByScore(k, min, max));
		await helpers.execBatch(batch);
	};

	module.sortedSetRemoveBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}
		const batch = module.client.batch();
		data.forEach(item => batch.zRem(item[0], String(item[1])));
		await helpers.execBatch(batch);
	};
};
