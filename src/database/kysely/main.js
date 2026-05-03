'use strict';

module.exports = function (module) {
	const { helpers } = module;

	module.flushdb = async function () {
		// Delete data from all tables (child tables first due to potential FK constraints)
		await module.emptydb();
		// Also clear sessions if exists
		await module.db.deleteFrom('sessions').execute().catch(() => {});
	};

	module.emptydb = async function () {
		// Delete data from all tables (child tables first, then parent)
		const childTables = ['legacy_string', 'legacy_list', 'legacy_set', 'legacy_zset', 'legacy_hash'];
		await Promise.all(childTables.map(table =>
			module.db.deleteFrom(table).execute().catch(() => {})));
		await module.db.deleteFrom('legacy_object').execute().catch(() => {});
	};

	module.exists = async function (key) {
		if (!key) {
			return;
		}

		const isArray = Array.isArray(key);
		if (isArray && !key.length) {
			return [];
		}

		const now = new Date().toISOString();

		// One round-trip: existence-by-membership for each key. Returns the
		// set of keys whose backing table has at least one row (already
		// expiry-filtered via `create*Query`).
		async function tableHasKey(createQuery, keys) {
			if (!keys.length) return new Set();
			const rows = await createQuery()
				.select('o._key')
				.where('o._key', 'in', keys)
				.groupBy('o._key')
				.execute();
			return new Set(rows.map(r => r._key));
		}

		// Redis/Mongo consider empty zsets/sets as non-existent — match that.
		// Implementation strategy: 3 SQL round-trips total regardless of key
		// count, replacing the previous fan-out of 3N round-trips
		// (one `module.type` per key + one membership probe per key).
		if (isArray) {
			// (a) Bulk type lookup for all keys.
			const typeRows = await module.db.selectFrom('legacy_object')
				.select(['_key', 'type'])
				.where('_key', 'in', key)
				.where(eb => eb.or([
					eb('expireAt', 'is', null),
					eb('expireAt', '>', now),
				]))
				.execute();
			const typeByKey = Object.fromEntries(typeRows.map(r => [r._key, r.type]));

			const zsetKeys = key.filter(k => typeByKey[k] === 'zset');
			const setKeys = key.filter(k => typeByKey[k] === 'set');

			// (b, c) Bulk existence for zset and set membership in parallel;
			// non-zset/non-set keys are present iff `legacy_object` matched
			// (already checked above via typeByKey).
			const [presentZsets, presentSets] = await Promise.all([
				tableHasKey(helpers.createZsetQuery, zsetKeys),
				tableHasKey(helpers.createSetQuery, setKeys),
			]);

			return key.map((k) => {
				const t = typeByKey[k];
				if (t === 'zset') return presentZsets.has(k);
				if (t === 'set') return presentSets.has(k);
				return t != null;
			});
		}

		const type = await module.type(key);
		if (type === 'zset') {
			const members = await module.getSortedSetRange(key, 0, 0);
			return members.length > 0;
		} else if (type === 'set') {
			const members = await module.getSetMembers(key);
			return members.length > 0;
		}

		let query = module.db.selectFrom('legacy_object')
			.select('_key')
			.where('_key', '=', key);
		query = helpers.whereNotExpired(query, null, now);
		const result = await query.limit(1).executeTakeFirst();

		return !!result;
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

		// Delete from child tables first
		const childTables = ['legacy_string', 'legacy_hash', 'legacy_zset', 'legacy_set', 'legacy_list'];
		await Promise.all(childTables.map(table =>
			module.db.deleteFrom(table)
				.where('_key', '=', key)
				.execute()
				.catch(() => {}))); // Ignore errors if key doesn't exist in table

		// Then delete from parent table
		await module.db.deleteFrom('legacy_object')
			.where('_key', '=', key)
			.execute();
	};

	module.deleteAll = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		// Delete from child tables first
		const childTables = ['legacy_string', 'legacy_hash', 'legacy_zset', 'legacy_set', 'legacy_list'];
		await Promise.all(childTables.map(table =>
			module.db.deleteFrom(table)
				.where('_key', 'in', keys)
				.execute()
				.catch(() => {}))); // Ignore errors if keys don't exist in table

		// Then delete from parent table
		await module.db.deleteFrom('legacy_object')
			.where('_key', 'in', keys)
			.execute();
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
			// Delete the new key if it exists (CASCADE will delete child rows too)
			await client.deleteFrom('legacy_object')
				.where('_key', '=', newKey)
				.execute()
				.catch(() => {});

			// Get old key's type and expireAt so we can create the new parent row first
			const oldRow = await client.selectFrom('legacy_object')
				.select(['type', 'expireAt'])
				.where('_key', '=', oldKey)
				.executeTakeFirst();

			if (!oldRow) {
				// Old key doesn't exist, nothing to rename
				return;
			}

			// Insert new parent row first (so FK constraint is satisfied when updating children)
			await client.insertInto('legacy_object')
				.values({ _key: newKey, type: oldRow.type, expireAt: oldRow.expireAt })
				.execute();

			// Update child tables in parallel to point to the new key
			const tables = ['legacy_hash', 'legacy_zset', 'legacy_set', 'legacy_list', 'legacy_string'];
			await Promise.all(tables.map(table => client.updateTable(table)
				.set({ _key: newKey })
				.where('_key', '=', oldKey)
				.execute()
				.catch(() => {}))); // Ignore if key doesn't exist in this table

			// Delete the old parent row (CASCADE will clean up any remaining children)
			await client.deleteFrom('legacy_object')
				.where('_key', '=', oldKey)
				.execute();
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