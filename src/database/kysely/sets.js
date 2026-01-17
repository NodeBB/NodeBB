'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

	module.setAdd = async function (key, value) {
		if (!key) {
			return;
		}

		const values = Array.isArray(value) ? value : [value];
		if (!values.length) {
			return;
		}

		await helpers.withTransaction(module, key, 'set', async (client, dialect) => {
			const rows = values.map(v => ({
				_key: key,
				member: String(v),
			}));
			await helpers.upsertMultiple(client, 'legacy_set', rows, ['_key', 'member'], [], dialect);
		});
	};

	module.setsBulkAdd = async function (keys, values) {
		if (!keys.length || !values.length) {
			return;
		}
		if (keys.length !== values.length) {
			throw new Error('[[error:invalid-data]]');
		}

		await helpers.withTransaction(module, null, null, async (client, dialect) => {
			const uniqueKeys = [...new Set(keys)];
			await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'set', dialect);

			// Collect all rows
			const allRows = [];
			for (let i = 0; i < keys.length; i += 1) {
				const key = keys[i];
				const value = values[i];
				const members = Array.isArray(value) ? value : [value];

				for (const v of members) {
					allRows.push({
						_key: key,
						member: String(v),
					});
				}
			}

			if (allRows.length) {
				await helpers.upsertMultiple(client, 'legacy_set', allRows, ['_key', 'member'], [], dialect);
			}
		});
	};

	module.setAddBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}

		await helpers.withTransaction(module, null, null, async (client, dialect) => {
			const uniqueKeys = [...new Set(data.map(d => d[0]))];
			await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'set', dialect);

			const rows = data.map(([key, value]) => ({
				_key: key,
				member: String(value),
			}));
			await helpers.upsertMultiple(client, 'legacy_set', rows, ['_key', 'member'], [], dialect);
		});
	};

	module.setsAdd = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		await helpers.withTransactionKeys(module, keys, 'set', async (client, dialect) => {
			const values = Array.isArray(value) ? value : [value];

			// Collect all rows
			const allRows = [];
			for (const key of keys) {
				for (const v of values) {
					allRows.push({
						_key: key,
						member: String(v),
					});
				}
			}

			if (allRows.length) {
				await helpers.upsertMultiple(client, 'legacy_set', allRows, ['_key', 'member'], [], dialect);
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

		const result = await helpers.createSetQuery(module.db, module.dialect)
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

		const result = await helpers.createSetQuery(module.db, module.dialect)
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

		const result = await helpers.createSetQuery(module.db, module.dialect)
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

		const result = await helpers.createSetQuery(module.db, module.dialect)
			.select('s.member')
			.where('o._key', '=', key)
			.execute();

		return result.map(r => r.member);
	};

	module.getSetsMembers = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const result = await helpers.createSetQuery(module.db, module.dialect)
			.select(['s._key', 's.member'])
			.where('o._key', 'in', keys)
			.execute();

		return helpers.mapResultsToKeysArray(keys, result, '_key', r => r.member);
	};

	module.setCount = async function (key) {
		if (!key) {
			return 0;
		}

		const result = await helpers.createSetQuery(module.db, module.dialect)
			.select(eb => eb.fn.countAll().as('count'))
			.where('o._key', '=', key)
			.executeTakeFirst();

		return parseInt(result?.count || 0, 10);
	};

	module.setsCount = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const result = await helpers.createSetQuery(module.db, module.dialect)
			.select(['s._key'])
			.select(eb => eb.fn.countAll().as('count'))
			.where('o._key', 'in', keys)
			.groupBy('s._key')
			.execute();

		return helpers.mapCountsToKeys(keys, result, '_key', 'count');
	};

	module.setRemoveRandom = async function (key) {
		if (!key) {
			return;
		}

		const randomMember = await helpers.createSetQuery(module.db, module.dialect)
			.select('s.member')
			.where('o._key', '=', key)
			.limit(1)
			.executeTakeFirst();

		if (!randomMember) {
			return null;
		}

		await module.db.deleteFrom('legacy_set')
			.where('_key', '=', key)
			.where('member', '=', randomMember.member)
			.execute();

		return randomMember.member;
	};
};