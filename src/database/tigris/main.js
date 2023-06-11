'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');
	module.flushdb = async function () {
		// same as `dropDatabase` when all collections are dropped
		await module.client.dropAllCollections();
	};

	module.emptydb = async function () {
		await module.client.getCollection('objects').deleteMany({ filter: {} });
		module.objectCache.reset();
	};

	module.exists = async function (key) {
		if (!key) {
			return;
		}

		if (Array.isArray(key)) {
			if (!key.length) {
				return;
			}
			const data = await module.client.getCollection('objects').findMany({
				filter: key.length === 1 ? { _key: key[0] } : { $or: key.map(k => ({ _key: k })) },
				fields: { include: ['_key'] },
			}).toArray();

			const map = {};
			data.forEach((item) => {
				map[item._key] = true;
			});

			return key.map(key => !!map[key]);
		}

		const item = await module.client.getCollection('objects').findOne({
			filter: { _key: key },
			fields: { include: ['_key'] },
		});

		return item !== undefined && item !== null;
	};

	module.upsert = async function (key, increment = null) {
		if (!key) {
			return;
		}
		const item = await module.client.getCollection('objects').findOne({
			filter: Array.isArray(key) && key.length > 1 ? { $or: key.map(k => ({ _key: k })) } :
				{ _key: Array.isArray(key) ? key[0] : key },
		});
		key = Array.isArray(key) ? key[0] : key;
		let incrementExist = true;
		if (increment) {
			incrementExist = Array.isArray(increment) ?
				increment.every(field => item && typeof item[field] !== 'undefined') : item && typeof item[increment] !== 'undefined';

			// Return the item if it exists and the increment exists
			if (incrementExist) {
				return item;
			}
		}

		const data = {};
		if (!item || !incrementExist) {
			if (increment) {
				if (Array.isArray(increment)) {
					increment.forEach((field) => {
						data[field] = (item && item[field]) || 0;
					});
				} else {
					data[increment] = 0;
				}
			}
			if (item) {
				await module.client.getCollection('objects').updateOne({
					filter: { _key: key },
					fields: data,
				});
			} else {
				await module.client.getCollection('objects').insertOne({ ...data, _key: key });
			}

			return data;
		}
	};
	module.upsertFilter = async function (filter, increment = null) {
		if (!filter) {
			return;
		}
		const item = await module.client.getCollection('objects').findOne({
			filter,
		});
		let incrementExist = true;
		if (increment || !incrementExist) {
			incrementExist = Array.isArray(increment) ?
				increment.every(field => item && typeof item[field] !== 'undefined') : item && typeof item[increment] !== 'undefined';
			// Return the item if it exists and the increment exists
			if (incrementExist) {
				return item;
			}
		}

		const data = {};
		if (!item || !incrementExist) {
			if (increment) {
				if (Array.isArray(increment)) {
					increment.forEach((field) => {
						data[field] = 0;
					});
				} else {
					data[increment] = 0;
				}
			}
			if (item) {
				await module.client.getCollection('objects').updateOne({
					filter: filter,
					fields: data,
				});
			} else {
				await module.client.getCollection('objects').insertOne({ ...data, ...filter });
			}

			return data;
		}
	};

	module.scan = async function (params) {
		// TODO - This needs to be implemented for tigris.
		console.log('scan not implemented for tigriscomp');
		const match = helpers.buildMatchQuery(params.match);
		return await module.client.getCollection('objects').distinct(
			'_key', { _key: { $regex: new RegExp(match) } }
		);
	};

	module.delete = async function (key) {
		if (!key) {
			return;
		}
		await module.client.getCollection('objects').deleteMany({ filter: { _key: key } });
		module.objectCache.del(key);
	};

	module.deleteAll = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		await module.client.getCollection('objects').deleteMany({
			filter: keys.length === 1 ? { _key: keys[0] } : { $or: keys.map(k => ({ _key: k })) },
		});
		module.objectCache.del(keys);
	};

	module.get = async function (key) {
		if (!key) {
			return;
		}

		const objectData = await module.client.getCollection('objects').findOne(
			{ filter: { _key: key }, fields: { exclude: ['_id'] } }
		);

		// fallback to old field name 'value' for backwards compatibility #6340
		let value = null;
		if (objectData) {
			if (objectData.data !== undefined) {
				value = objectData.data;
			} else if (objectData.value !== undefined) {
				value = objectData.value;
			}
		}
		return value;
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

		await module.upsert(key, 'data');
		await module.client.getCollection('objects').updateOne({
			filter: { _key: key },
			fields: { $increment: { data: 1 } },
		});
		const result = await module.client.getCollection('objects')
			.findOne({ filter: { _key: key }, fields: { include: ['data'] } });

		return result && result.data ? result.data : null;
	};

	module.rename = async function (oldKey, newKey) {
		await module.client.getCollection('objects').updateMany({
			filter: { _key: oldKey },
			fields: { _key: newKey },
		});
		module.objectCache.del([oldKey, newKey]);
	};

	module.type = async function (key) {
		const data = await module.client.getCollection('objects').findOne({ filter: { _key: key } });

		if (!data) {
			return null;
		}
		delete data.expireAt;
		const keys = Object.keys(data);
		if (keys.length === 4 && data._key !== undefined && data.score !== undefined && data.value !== undefined) {
			return 'zset';
		} else if (keys.length === 3 && data._key !== undefined && data.members !== undefined) {
			return 'set';
		} else if (keys.length === 3 && data._key !== undefined && data.array !== undefined) {
			return 'list';
		} else if (keys.length === 3 && data._key !== undefined && data.data !== undefined) {
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
