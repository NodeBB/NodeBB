
'use strict';

import helpers from '../helpers';


export default  function (module) {

	module.sortedSetRemove = async function (key: string, value) {
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
			key.forEach(k => batch.zrem(k, value));
			await helpers.execBatch(batch);
		} else {
			await module.client.zrem(key, value);
		}
	};

	module.sortedSetsRemove = async function (keys: string[], value: string) {
		await module.sortedSetRemove(keys, value);
	};

	module.sortedSetsRemoveRangeByScore = async function (keys: string[], min: number, max: number) {
		const batch = module.client.batch();
		keys.forEach(k => batch.zremrangebyscore(k, min, max));
		await helpers.execBatch(batch);
	};

	module.sortedSetRemoveBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}
		const batch = module.client.batch();
		data.forEach((item) => batch.zrem(item[0], item[1]));
		await helpers.execBatch(batch);
	};
};
