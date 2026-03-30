'use strict';

module.exports = function (module) {
	module.listPrepend = async function (key, value) {
		if (!key) {
			return;
		}
		await module.client.lPush(key, Array.isArray(value) ? value.map(String) : String(value));
	};

	module.listAppend = async function (key, value) {
		if (!key) {
			return;
		}
		await module.client.rPush(key, Array.isArray(value) ? value.map(String) : String(value));
	};

	module.listRemoveLast = async function (key) {
		if (!key) {
			return;
		}
		return await module.client.rPop(key);
	};

	module.listRemoveAll = async function (key, value) {
		if (!key) {
			return;
		}
		if (Array.isArray(value)) {
			const batch = module.client.multi();
			value.forEach(value => batch.lRem(key, 0, value));
			await batch.execAsPipeline();
		} else {
			await module.client.lRem(key, 0, value);
		}
	};

	module.listTrim = async function (key, start, stop) {
		if (!key) {
			return;
		}
		await module.client.lTrim(key, start, stop);
	};

	module.getListRange = async function (key, start, stop) {
		if (!key) {
			return;
		}
		return await module.client.lRange(key, start, stop);
	};

	module.listLength = async function (key) {
		return await module.client.lLen(key);
	};
};
