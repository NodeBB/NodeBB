'use strict';

module.exports = function (module) {
	module.flushdb = async function () {
		await module.client.dropDatabase();
	};

	module.emptydb = async function () {
		await module.client.collection('objects').deleteMany({});
		module.objectCache.resetObjectCache();
	};

	module.exists = async function (key) {
		if (!key) {
			return;
		}
		if (Array.isArray(key)) {
			const data = await module.client.collection('objects').find({ _key: { $in: key } }).toArray();
			var map = {};
			data.forEach(function (item) {
				map[item._key] = true;
			});

			return key.map(key => !!map[key]);
		}
		const item = await module.client.collection('objects').findOne({ _key: key });
		return item !== undefined && item !== null;
	};

	module.delete = async function (key) {
		if (!key) {
			return;
		}
		await module.client.collection('objects').deleteMany({ _key: key });
		module.objectCache.delObjectCache(key);
	};

	module.deleteAll = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		await module.client.collection('objects').deleteMany({ _key: { $in: keys } });
		module.objectCache.delObjectCache(keys);
	};

	module.get = async function (key) {
		if (!key) {
			return;
		}

		const objectData = await module.client.collection('objects').findOne({ _key: key }, { projection: { _id: 0 } });

		// fallback to old field name 'value' for backwards compatibility #6340
		var value = null;
		if (objectData) {
			if (objectData.hasOwnProperty('data')) {
				value = objectData.data;
			} else if (objectData.hasOwnProperty('value')) {
				value = objectData.value;
			}
		}
		return value;
	};

	module.set = async function (key, value) {
		if (!key) {
			return;
		}
		var data = { data: value };
		await module.setObject(key, data);
	};

	module.increment = async function (key) {
		if (!key) {
			return;
		}
		const result = await module.client.collection('objects').findOneAndUpdate({ _key: key }, { $inc: { data: 1 } }, { returnOriginal: false, upsert: true });
		return result && result.value ? result.value.data : null;
	};

	module.rename = async function (oldKey, newKey) {
		await module.client.collection('objects').updateMany({ _key: oldKey }, { $set: { _key: newKey } });
		module.objectCache.delObjectCache([oldKey, newKey]);
	};

	module.type = async function (key) {
		const data = await module.client.collection('objects').findOne({ _key: key });
		if (!data) {
			return null;
		}
		delete data.expireAt;
		var keys = Object.keys(data);
		if (keys.length === 4 && data.hasOwnProperty('_key') && data.hasOwnProperty('score') && data.hasOwnProperty('value')) {
			return 'zset';
		} else if (keys.length === 3 && data.hasOwnProperty('_key') && data.hasOwnProperty('members')) {
			return 'set';
		} else if (keys.length === 3 && data.hasOwnProperty('_key') && data.hasOwnProperty('array')) {
			return 'list';
		} else if (keys.length === 3 && data.hasOwnProperty('_key') && data.hasOwnProperty('data')) {
			return 'string';
		}
		return 'hash';
	};

	module.expire = async function (key, seconds) {
		await module.expireAt(key, Math.round(Date.now() / 1000) + seconds);
	};

	module.expireAt = async function (key, timestamp) {
		await module.setObjectField(key, 'expireAt', new Date(timestamp * 1000));
	};

	module.pexpire = async function (key, ms) {
		await module.pexpireAt(key, Date.now() + parseInt(ms, 10));
	};

	module.pexpireAt = async function (key, timestamp) {
		timestamp = Math.min(timestamp, 8640000000000000);
		await module.setObjectField(key, 'expireAt', new Date(timestamp));
	};
};
