'use strict';

module.exports = function (module) {
	const { helpers } = module;

	module.setAdd = async function (key, value) {
		if (!key) {
			return;
		}

		const values = Array.isArray(value) ? value : [value];
		if (!values.length) {
			return;
		}

		await helpers.withTransaction(key, 'set', async (client) => {
			const rows = values.map(v => ({
				_key: key,
				member: String(v),
			}));
			await helpers.upsertMultiple(client, 'legacy_set', rows, ['_key', 'member'], []);
		});
	};

	module.setsBulkAdd = async function (keys, values) {
		if (!keys.length || !values.length) {
			return;
		}
		if (keys.length !== values.length) {
			throw new Error('[[error:invalid-data]]');
		}

		await helpers.withTransaction(null, null, async (client) => {
			const uniqueKeys = [...new Set(keys)];
			await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'set');

			// Collect all rows using flatMap
			const allRows = keys.flatMap((key, i) => {
				const members = Array.isArray(values[i]) ? values[i] : [values[i]];
				return members.map(v => ({ _key: key, member: String(v) }));
			});

			if (allRows.length) {
				await helpers.upsertMultiple(client, 'legacy_set', allRows, ['_key', 'member'], []);
			}
		});
	};

	module.setAddBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}

		await helpers.withTransaction(null, null, async (client) => {
			const uniqueKeys = [...new Set(data.map(d => d[0]))];
			await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'set');

			const rows = data.map(([key, value]) => ({
				_key: key,
				member: String(value),
			}));
			await helpers.upsertMultiple(client, 'legacy_set', rows, ['_key', 'member'], []);
		});
	};

	module.setsAdd = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		await helpers.withTransactionKeys(keys, 'set', async (client) => {
			const values = Array.isArray(value) ? value : [value];

			// Collect all rows using flatMap
			const allRows = keys.flatMap(key => values.map(v => ({ _key: key, member: String(v) })));

			if (allRows.length) {
				await helpers.upsertMultiple(client, 'legacy_set', allRows, ['_key', 'member'], []);
			}
		});
	};

	module.setRemove = async function (key, value) {
		if (!key) {
			return;
		}

		const values = Array.isArray(value) ? value.map(String) : [String(value)];
		if (!values.length) {
			return;
		}

		const keys = Array.isArray(key) ? key : [key];

		await module.db.deleteFrom('legacy_set')
			.where('_key', 'in', keys)
			.where('member', 'in', values)
			.execute();
	};

	module.setsRemove = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		await module.db.deleteFrom('legacy_set')
			.where('_key', 'in', keys)
			.where('member', '=', String(value))
			.execute();
	};

	module.isSetMember = async function (key, value) {
		if (!key) {
			return false;
		}

		const result = await helpers.createSetQuery()
			.select('s.member')
			.where('o._key', '=', key)
			.where('s.member', '=', String(value))
			.limit(1)
			.executeTakeFirst();

		return !!result;
	};

	module.isSetMembers = async function (key, values) {
		if (!key || !Array.isArray(values) || !values.length) {
			return values.map(() => false);
		}

		const stringValues = values.map(String);

		const result = await helpers.createSetQuery()
			.select('s.member')
			.where('o._key', '=', key)
			.where('s.member', 'in', stringValues)
			.execute();

		const memberSet = new Set(result.map(r => r.member));
		return stringValues.map(v => memberSet.has(v));
	};

	module.isMemberOfSets = async function (sets, value) {
		if (!Array.isArray(sets) || !sets.length) {
			return [];
		}

		const member = String(value);

		const result = await helpers.createSetQuery()
			.select('s._key')
			.where('o._key', 'in', sets)
			.where('s.member', '=', member)
			.execute();

		const keySet = new Set(result.map(r => r._key));
		return sets.map(s => keySet.has(s));
	};

	module.getSetMembers = async function (key) {
		if (!key) {
			return [];
		}

		const result = await helpers.createSetQuery()
			.select('s.member')
			.where('o._key', '=', key)
			.execute();

		return result.map(r => r.member);
	};

	module.getSetsMembers = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const result = await helpers.createSetQuery()
			.select(['s._key', 's.member'])
			.where('o._key', 'in', keys)
			.execute();

		return helpers.mapResultsToKeysArray(keys, result, '_key', r => r.member);
	};

	module.setCount = async function (key) {
		if (!key) {
			return 0;
		}

		const result = await helpers.createSetQuery()
			.select(eb => eb.fn.countAll().as('count'))
			.where('o._key', '=', key)
			.executeTakeFirst();

		return parseInt(result?.count || 0, 10);
	};

	module.setsCount = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const result = await helpers.createSetQuery()
			.select(['s._key'])
			.select(eb => eb.fn.countAll().as('count'))
			.where('o._key', 'in', keys)
			.groupBy('s._key')
			.execute();

		return helpers.mapCountsToKeys(keys, result, '_key', 'count');
	};

	module.setRemoveRandom = async function (key) {
		if (!key) {
			return null;
		}

		return await helpers.withTransaction(null, null, async (client) => {
			const now = new Date().toISOString();

			// Build query for a random member
			let query = client.selectFrom('legacy_object as o')
				.innerJoin('legacy_set as s', 's._key', 'o._key')
				.select('s.member')
				.where('o._key', '=', key)
				.where('o.type', '=', 'set')
				.where(eb => eb.or([
					eb('o.expireAt', 'is', null),
					eb('o.expireAt', '>', now),
				]))
				.limit(1);

			// Add locking if supported (prevents race condition)
			if (module.supportsLocking) {
				query = query.forUpdate();
			}

			const randomMember = await query.executeTakeFirst();

			if (!randomMember) {
				return null;
			}

			await client.deleteFrom('legacy_set')
				.where('_key', '=', key)
				.where('member', '=', randomMember.member)
				.execute();

			return randomMember.member;
		});
	};
};