'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');
	module.flushdb = async function () {
		await module.client.dropDatabase();
	};

	module.emptydb = async function () {
		await module.client.collection('objects').deleteMany({});
		module.objectCache.reset();
	};

	module.exists = async function (key) {
		if (!key) {
			return;
		}

		if (Array.isArray(key)) {
			if (!key.length) {
				return [];
			}
			const data = await module.client.collection('objects').find({
				_key: { $in: key },
			}, { _id: 0, _key: 1 }).toArray();

			const map = Object.create(null);
			data.forEach((item) => {
				map[item._key] = true;
			});

			return key.map(key => !!map[key]);
		}

		const item = await module.client.collection('objects').findOne({
			_key: key,
		}, { _id: 0, _key: 1 });
		return item !== undefined && item !== null;
	};

	module.scan = async function (params) {
		const match = helpers.buildMatchQuery(params.match);
		return await module.client.collection('objects').distinct(
			'_key', { _key: { $regex: new RegExp(match) } }
		);
	};

	module.delete = async function (key) {
		if (!key) {
			return;
		}
		await module.client.collection('objects').deleteMany({ _key: key });
		module.objectCache.del(key);
	};

	module.deleteAll = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		await module.client.collection('objects').deleteMany({ _key: { $in: keys } });
		module.objectCache.del(keys);
	};

	module.get = async function (key) {
		if (!key) {
			return;
		}

		const objectData = await module.client.collection('objects').findOne({ _key: key }, { projection: { _id: 0 } });

		// fallback to old field name 'value' for backwards compatibility #6340
		let value = null;
		if (objectData) {
			if (objectData.hasOwnProperty('data')) {
				value = objectData.data;
			} else if (objectData.hasOwnProperty('value')) {
				value = objectData.value;
			}
		}
		return value;
	};

	module.mget = async function (keys) {
		if (!keys || !Array.isArray(keys) || !keys.length) {
			return [];
		}

		const data = await module.client.collection('objects').find(
			{ _key: { $in: keys } },
			{ projection: { _id: 0 } }
		).toArray();

		const map = {};
		data.forEach((d) => {
			map[d._key] = d.data;
		});

		return keys.map(k => (map.hasOwnProperty(k) ? map[k] : null));
	};

	module.set = async function (key, value) {
		if (!key) {
			return;
		}
		await module.setObject(key, { data: value });
	};

	module.increment = async function (key) {
		if (!key) {
			return;
		}
		const result = await module.client.collection('objects').findOneAndUpdate({
			_key: key,
		}, {
			$inc: { data: 1 },
		}, {
			returnDocument: 'after',
			includeResultMetadata: true,
			upsert: true,
		});
		return result && result.value ? result.value.data : null;
	};

	module.rename = async function (oldKey, newKey) {
		await module.client.collection('objects').updateMany({ _key: oldKey }, { $set: { _key: newKey } });
		module.objectCache.del([oldKey, newKey]);
	};

	module.type = async function (key) {
		const data = await module.client.collection('objects').findOne({ _key: key });
		if (!data) {
			return null;
		}
		delete data.expireAt;
		const keys = Object.keys(data);
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

	module.ttl = async function (key) {
		return Math.round((await module.getObjectField(key, 'expireAt') - Date.now()) / 1000);
	};

	module.pttl = async function (key) {
		return await module.getObjectField(key, 'expireAt') - Date.now();
	};
};
