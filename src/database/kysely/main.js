'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

	module.flushdb = async function () {
		// Drop all legacy tables and recreate
		const tables = ['legacy_string', 'legacy_list', 'legacy_set', 'legacy_zset', 'legacy_hash', 'legacy_object'];
		
		for (const table of tables) {
			try {
				await module.db.schema.dropTable(table).ifExists().execute();
			} catch (err) {
				// Ignore errors during drop
			}
		}
		
		// Re-run init to recreate tables
		const connection = require('./connection');
		const opts = require('nconf').get('kysely');
		module.db = await connection.createKyselyInstance(opts);
	};

	module.emptydb = async function () {
		await module.db.deleteFrom('legacy_object').execute();
	};

	module.exists = async function (key) {
		if (!key) {
			return;
		}
		
		const isArray = Array.isArray(key);
		if (isArray && !key.length) {
			return [];
		}
		
		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);

		async function checkIfzSetsExist(keys) {
			const members = await Promise.all(
				keys.map(k => module.getSortedSetRange(k, 0, 0))
			);
			return members.map(member => member.length > 0);
		}

		async function checkIfSetsExist(keys) {
			const members = await Promise.all(keys.map(module.getSetMembers));
			return members.map(member => member.length > 0);
		}

		async function checkIfKeysExist(keys) {
			const result = await module.db.selectFrom('legacy_object')
				.select('_key')
				.where('_key', 'in', keys)
				.where(eb => eb.or([
					eb('expireAt', 'is', null),
					eb('expireAt', '>', now),
				]))
				.execute();
			
			return keys.map(k => result.some(r => r._key === k));
		}

		// Redis/Mongo consider empty zsets as non-existent, match that behaviour
		if (isArray) {
			const types = await Promise.all(key.map(module.type));
			const zsetKeys = key.filter((_key, i) => types[i] === 'zset');
			const setKeys = key.filter((_key, i) => types[i] === 'set');
			const otherKeys = key.filter((_key, i) => types[i] !== 'zset' && types[i] !== 'set');
			const [zsetExits, setExists, otherExists] = await Promise.all([
				checkIfzSetsExist(zsetKeys),
				checkIfSetsExist(setKeys),
				checkIfKeysExist(otherKeys),
			]);
			const existsMap = Object.create(null);
			zsetKeys.forEach((k, i) => { existsMap[k] = zsetExits[i]; });
			setKeys.forEach((k, i) => { existsMap[k] = setExists[i]; });
			otherKeys.forEach((k, i) => { existsMap[k] = otherExists[i]; });
			return key.map(k => existsMap[k]);
		}
		
		const type = await module.type(key);
		if (type === 'zset') {
			const members = await module.getSortedSetRange(key, 0, 0);
			return members.length > 0;
		} else if (type === 'set') {
			const members = await module.getSetMembers(key);
			return members.length > 0;
		}
		
		const result = await module.db.selectFrom('legacy_object')
			.select('_key')
			.where('_key', '=', key)
			.where(eb => eb.or([
				eb('expireAt', 'is', null),
				eb('expireAt', '>', now),
			]))
			.limit(1)
			.executeTakeFirst();

		return !!result;
	};

	module.scan = async function (params) {
		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);
		const pattern = helpers.buildLikePattern(params.match);

		const result = await module.db.selectFrom('legacy_object')
			.select('_key')
			.where('_key', 'like', pattern)
			.where(eb => eb.or([
				eb('expireAt', 'is', null),
				eb('expireAt', '>', now),
			]))
			.execute();

		return result.map(r => r._key);
	};

	module.delete = async function (key) {
		if (!key) {
			return;
		}

		await module.db.deleteFrom('legacy_object')
			.where('_key', '=', key)
			.execute();
	};

	module.deleteAll = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		await module.db.deleteFrom('legacy_object')
			.where('_key', 'in', keys)
			.execute();
	};

	module.get = async function (key) {
		if (!key) {
			return;
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_string as s', 's._key', 'o._key')
			.select('s.data')
			.where('o._key', '=', key)
			.where('o.type', '=', 'string')
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.limit(1)
			.executeTakeFirst();

		return result ? result.data : null;
	};

	module.mget = async function (keys) {
		if (!keys || !Array.isArray(keys) || !keys.length) {
			return [];
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_string as s', 's._key', 'o._key')
			.select(['s._key', 's.data'])
			.where('o._key', 'in', keys)
			.where('o.type', '=', 'string')
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.execute();

		const map = {};
		result.forEach((d) => {
			map[d._key] = d.data;
		});
		return keys.map(k => (map.hasOwnProperty(k) ? map[k] : null));
	};

	module.set = async function (key, value) {
		if (!key) {
			return;
		}

		const {dialect} = module;

		await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectType(client, key, 'string', dialect);
			
			await helpers.upsert(client, 'legacy_string', {
				_key: key,
				data: String(value),
			}, ['_key'], { data: String(value) }, dialect);
		});
	};

	module.increment = async function (key) {
		if (!key) {
			return;
		}

		const {dialect} = module;

		return await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectType(client, key, 'string', dialect);
			
			// Get current value
			const current = await client.selectFrom('legacy_string')
				.select('data')
				.where('_key', '=', key)
				.executeTakeFirst();
			
			const currentValue = current ? parseFloat(current.data) || 0 : 0;
			const newValue = currentValue + 1;
			
			await helpers.upsert(client, 'legacy_string', {
				_key: key,
				data: String(newValue),
			}, ['_key'], { data: String(newValue) }, dialect);
			
			return newValue;
		});
	};

	module.rename = async function (oldKey, newKey) {
		await module.transaction(async (client) => {
			// Delete the new key if it exists
			await client.deleteFrom('legacy_object')
				.where('_key', '=', newKey)
				.execute();
			
			// Update child tables first (they reference the old key)
			const tables = ['legacy_hash', 'legacy_zset', 'legacy_set', 'legacy_list', 'legacy_string'];
			for (const table of tables) {
				await client.updateTable(table)
					.set({ _key: newKey })
					.where('_key', '=', oldKey)
					.execute()
					.catch(() => {}); // Ignore if key doesn't exist in this table
			}
			
			// Rename the key in legacy_object
			await client.updateTable('legacy_object')
				.set({ _key: newKey })
				.where('_key', '=', oldKey)
				.execute();
		});
	};

	module.type = async function (key) {
		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);

		const result = await module.db.selectFrom('legacy_object')
			.select('type')
			.where('_key', '=', key)
			.where(eb => eb.or([
				eb('expireAt', 'is', null),
				eb('expireAt', '>', now),
			]))
			.limit(1)
			.executeTakeFirst();

		return result ? result.type : null;
	};

	async function doExpire(key, date) {
		const {dialect} = module;
		const expireAt = helpers.getExpireAtTimestamp(date, dialect);
		
		await module.db.updateTable('legacy_object')
			.set({ expireAt: expireAt })
			.where('_key', '=', key)
			.execute();
	}

	module.expire = async function (key, seconds) {
		await doExpire(key, new Date(((Date.now() / 1000) + seconds) * 1000));
	};

	module.expireAt = async function (key, timestamp) {
		await doExpire(key, new Date(timestamp * 1000));
	};

	module.pexpire = async function (key, ms) {
		await doExpire(key, new Date(Date.now() + parseInt(ms, 10)));
	};

	module.pexpireAt = async function (key, timestamp) {
		await doExpire(key, new Date(timestamp));
	};

	async function getExpire(key) {
		const result = await module.db.selectFrom('legacy_object')
			.select('expireAt')
			.where('_key', '=', key)
			.limit(1)
			.executeTakeFirst();

		if (!result || !result.expireAt) {
			return null;
		}
		
		// Handle different date formats
		const {expireAt} = result;
		if (expireAt instanceof Date) {
			return expireAt.getTime();
		}
		return new Date(expireAt).getTime();
	}

	module.ttl = async function (key) {
		const expireAt = await getExpire(key);
		if (expireAt === null) {
			return null;
		}
		return Math.round((expireAt - Date.now()) / 1000);
	};

	module.pttl = async function (key) {
		const expireAt = await getExpire(key);
		if (expireAt === null) {
			return null;
		}
		return expireAt - Date.now();
	};
};