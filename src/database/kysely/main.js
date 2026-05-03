'use strict';

const _ = require('lodash');

const TYPE_TO_TABLE = {
	string: 'legacy_string',
	hash: 'legacy_hash',
	zset: 'legacy_zset',
	set: 'legacy_set',
	list: 'legacy_list',
};

module.exports = function (module) {
	const { helpers } = module;

	module.flushdb = async function () {
		// All-or-nothing wipe of forum data + session table.
		const childTables = ['legacy_string', 'legacy_list', 'legacy_set', 'legacy_zset', 'legacy_hash'];
		await helpers.withTransaction(null, null, async (client) => {
			for (const table of [...childTables, 'legacy_object', 'sessions']) {
				// eslint-disable-next-line no-await-in-loop
				await client.deleteFrom(table).execute().catch(() => {});
			}
		});
	};

	module.emptydb = async function () {
		// All-or-nothing wipe. Delete from child tables before parent so any
		// FK constraint is satisfied; do it inside one transaction so a partial
		// failure cannot leave dangling parent rows.
		const childTables = ['legacy_string', 'legacy_list', 'legacy_set', 'legacy_zset', 'legacy_hash'];
		await helpers.withTransaction(null, null, async (client) => {
			for (const table of childTables) {
				// eslint-disable-next-line no-await-in-loop
				await client.deleteFrom(table).execute().catch(() => {});
			}
			await client.deleteFrom('legacy_object').execute().catch(() => {});
		});
	};

	module.exists = async function (key) {
		if (!key) {
			return;
		}
		const isArray = Array.isArray(key);
		if (isArray && !key.length) {
			return [];
		}
		// All reads run in a single transaction so type lookup and child-table
		// existence probes see a consistent snapshot.
		return await helpers.withTransaction(null, null, async (client) => {
			const now = new Date().toISOString();
			const notExpired = q => helpers.whereNotExpired(q, null, now);

			// Bulk membership probe: returns the set of keys present in the
			// child table (expiry-filtered via the o-aliased query builder).
			const tableHasKey = async (createQuery, keys) => (keys.length ?
				new Set((await createQuery()
					.select('o._key')
					.where('o._key', 'in', keys)
					.groupBy('o._key')
					.execute()).map(r => r._key)) :
				new Set());

			const keys = isArray ? key : [key];
			const typeRows = await notExpired(
				client.selectFrom('legacy_object').select(['_key', 'type']).where('_key', 'in', keys),
			).execute();
			const typeByKey = Object.fromEntries(typeRows.map(r => [r._key, r.type]));

			// Redis/Mongo consider empty zsets/sets as non-existent — match
			// that. Non-zset/non-set keys exist iff `legacy_object` matched.
			const zsetKeys = keys.filter(k => typeByKey[k] === 'zset');
			const setKeys = keys.filter(k => typeByKey[k] === 'set');
			const [presentZsets, presentSets] = await Promise.all([
				tableHasKey(helpers.createZsetQuery, zsetKeys),
				tableHasKey(helpers.createSetQuery, setKeys),
			]);
			const exists = (k) => {
				const t = typeByKey[k];
				if (t === 'zset') return presentZsets.has(k);
				if (t === 'set') return presentSets.has(k);
				return t != null;
			};
			return isArray ? keys.map(exists) : exists(key);
		});
	};

	module.scan = async function (params) {
		const now = new Date().toISOString();
		const pattern = helpers.buildLikePattern(params.match);

		let query = module.db.selectFrom('legacy_object')
			.select('_key')
			.where('_key', 'like', pattern);
		query = helpers.whereNotExpired(query, null, now);
		const result = await query.execute();

		return result.map(r => r._key);
	};

	module.delete = async function (key) {
		if (!key) {
			return;
		}
		await helpers.withTransaction(null, null, async (client) => {
			const row = await client.selectFrom('legacy_object')
				.select('type')
				.where('_key', '=', key)
				.executeTakeFirst();
			if (!row) return;
			const table = TYPE_TO_TABLE[row.type];
			if (table) {
				await client.deleteFrom(table).where('_key', '=', key).execute().catch(() => {});
			}
			await client.deleteFrom('legacy_object').where('_key', '=', key).execute();
		});
	};

	module.deleteAll = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		await helpers.withTransaction(null, null, async (client) => {
			const rows = await client.selectFrom('legacy_object')
				.select(['_key', 'type'])
				.where('_key', 'in', keys)
				.execute();
			if (!rows.length) return;
			const byType = _.groupBy(rows, 'type');
			await Promise.all(Object.entries(byType).map(([type, group]) => {
				const table = TYPE_TO_TABLE[type];
				if (!table) return null;
				return client.deleteFrom(table)
					.where('_key', 'in', group.map(r => r._key))
					.execute()
					.catch(() => {});
			}));
			await client.deleteFrom('legacy_object').where('_key', 'in', rows.map(r => r._key)).execute();
		});
	};

	module.get = async function (key) {
		if (!key) {
			return;
		}

		const result = await helpers.createStringQuery()
			.select('s.data')
			.where('o._key', '=', key)
			.limit(1)
			.executeTakeFirst();

		return result ? result.data : null;
	};

	module.mget = async function (keys) {
		if (!keys || !Array.isArray(keys) || !keys.length) {
			return [];
		}

		const result = await helpers.createStringQuery()
			.select(['s._key', 's.data'])
			.where('o._key', 'in', keys)
			.execute();

		return helpers.mapResultsToKeys(keys, result, '_key', 'data', null);
	};

	module.set = async function (key, value) {
		if (!key) {
			return;
		}

		await helpers.withTransaction(key, 'string', async (client) => {
			await helpers.upsert(client, 'legacy_string', {
				_key: key,
				data: String(value),
			}, ['_key'], { data: String(value) });
		});
	};

	module.increment = async function (key) {
		if (!key) {
			return;
		}

		return await helpers.withTransaction(key, 'string', async (client) => {
			// Get current value - ensureLegacyObjectType already deleted expired keys and their data
			const current = await client.selectFrom('legacy_string')
				.select('data')
				.where('_key', '=', key)
				.executeTakeFirst();

			const currentValue = current ? parseFloat(current.data) || 0 : 0;
			const newValue = currentValue + 1;

			await helpers.upsert(client, 'legacy_string', {
				_key: key,
				data: String(newValue),
			}, ['_key'], { data: String(newValue) });

			return newValue;
		});
	};

	module.rename = async function (oldKey, newKey) {
		await helpers.withTransaction(null, null, async (client) => {
			const oldRow = await client.selectFrom('legacy_object')
				.select(['type', 'expireAt'])
				.where('_key', '=', oldKey)
				.executeTakeFirst();
			if (!oldRow) return;

			const newRow = await client.selectFrom('legacy_object')
				.select('type')
				.where('_key', '=', newKey)
				.executeTakeFirst();
			if (newRow) {
				const newTable = TYPE_TO_TABLE[newRow.type];
				if (newTable) {
					await client.deleteFrom(newTable).where('_key', '=', newKey).execute().catch(() => {});
				}
				await client.deleteFrom('legacy_object').where('_key', '=', newKey).execute();
			}

			await client.insertInto('legacy_object')
				.values({ _key: newKey, type: oldRow.type, expireAt: oldRow.expireAt })
				.execute();

			const oldTable = TYPE_TO_TABLE[oldRow.type];
			if (oldTable) {
				await client.updateTable(oldTable)
					.set({ _key: newKey })
					.where('_key', '=', oldKey)
					.execute()
					.catch(() => {});
			}

			await client.deleteFrom('legacy_object').where('_key', '=', oldKey).execute();
		});
	};

	module.type = async function (key) {
		const now = new Date().toISOString();

		let query = module.db.selectFrom('legacy_object')
			.select('type')
			.where('_key', '=', key);
		query = helpers.whereNotExpired(query, null, now);
		const result = await query.limit(1).executeTakeFirst();

		return result ? result.type : null;
	};

	async function doExpire(key, date) {
		const expireAt = date.toISOString();

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
		const { expireAt } = result;
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