'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

	module.setAdd = async function (key, value) {
		if (!key) {
			return;
		}

		const {dialect} = module;

		const values = Array.isArray(value) ? value : [value];
		if (!values.length) {
			return;
		}

		await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectType(client, key, 'set', dialect);

			for (const v of values) {
				const member = String(v);
				await helpers.upsert(client, 'legacy_set', {
					_key: key,
					member: member,
				}, ['_key', 'member'], {}, dialect);
			}
		});
	};

	module.setsBulkAdd = async function (keys, values) {
		if (!keys.length || !values.length) {
			return;
		}
		if (keys.length !== values.length) {
			throw new Error('[[error:invalid-data]]');
		}

		const {dialect} = module;

		await module.transaction(async (client) => {
			const uniqueKeys = [...new Set(keys)];
			await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'set', dialect);

			for (let i = 0; i < keys.length; i++) {
				const key = keys[i];
				const value = values[i];
				const members = Array.isArray(value) ? value : [value];
				
				for (const v of members) {
					const member = String(v);
					await helpers.upsert(client, 'legacy_set', {
						_key: key,
						member: member,
					}, ['_key', 'member'], {}, dialect);
				}
			}
		});
	};

	module.setAddBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}

		const {dialect} = module;

		await module.transaction(async (client) => {
			const uniqueKeys = [...new Set(data.map(d => d[0]))];
			await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'set', dialect);

			for (const [key, value] of data) {
				const member = String(value);
				await helpers.upsert(client, 'legacy_set', {
					_key: key,
					member: member,
				}, ['_key', 'member'], {}, dialect);
			}
		});
	};

	module.setsAdd = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		const {dialect} = module;

		await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectsType(client, keys, 'set', dialect);

			const values = Array.isArray(value) ? value : [value];
			
			for (const key of keys) {
				for (const v of values) {
					const member = String(v);
					await helpers.upsert(client, 'legacy_set', {
						_key: key,
						member: member,
					}, ['_key', 'member'], {}, dialect);
				}
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

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_set as s', 's._key', 'o._key')
			.select('s.member')
			.where('o._key', '=', key)
			.where('s.member', '=', String(value))
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.limit(1)
			.executeTakeFirst();

		return !!result;
	};

	module.isSetMembers = async function (key, values) {
		if (!key || !Array.isArray(values) || !values.length) {
			return values.map(() => false);
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);
		const stringValues = values.map(String);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_set as s', 's._key', 'o._key')
			.select('s.member')
			.where('o._key', '=', key)
			.where('s.member', 'in', stringValues)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.execute();

		const memberSet = new Set(result.map(r => r.member));
		return stringValues.map(v => memberSet.has(v));
	};

	module.isMemberOfSets = async function (sets, value) {
		if (!Array.isArray(sets) || !sets.length) {
			return [];
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);
		const member = String(value);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_set as s', 's._key', 'o._key')
			.select('s._key')
			.where('o._key', 'in', sets)
			.where('s.member', '=', member)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.execute();

		const keySet = new Set(result.map(r => r._key));
		return sets.map(s => keySet.has(s));
	};

	module.getSetMembers = async function (key) {
		if (!key) {
			return [];
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_set as s', 's._key', 'o._key')
			.select('s.member')
			.where('o._key', '=', key)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.execute();

		return result.map(r => r.member);
	};

	module.getSetsMembers = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_set as s', 's._key', 'o._key')
			.select(['s._key', 's.member'])
			.where('o._key', 'in', keys)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.execute();

		const map = {};
		keys.forEach((k) => {
			map[k] = [];
		});
		result.forEach((row) => {
			map[row._key].push(row.member);
		});

		return keys.map(k => map[k]);
	};

	module.setCount = async function (key) {
		if (!key) {
			return 0;
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_set as s', 's._key', 'o._key')
			.select(eb => eb.fn.countAll().as('count'))
			.where('o._key', '=', key)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.executeTakeFirst();

		return parseInt(result?.count || 0, 10);
	};

	module.setsCount = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);

		const result = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_set as s', 's._key', 'o._key')
			.select(['s._key'])
			.select(eb => eb.fn.countAll().as('count'))
			.where('o._key', 'in', keys)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
			.groupBy('s._key')
			.execute();

		const map = {};
		result.forEach((row) => {
			map[row._key] = parseInt(row.count, 10);
		});

		return keys.map(k => map[k] || 0);
	};

	module.setRemoveRandom = async function (key) {
		if (!key) {
			return;
		}

		const {dialect} = module;
		const now = helpers.getCurrentTimestamp(dialect);

		const randomMember = await module.db.selectFrom('legacy_object as o')
			.innerJoin('legacy_set as s', 's._key', 'o._key')
			.select('s.member')
			.where('o._key', '=', key)
			.where(eb => eb.or([
				eb('o.expireAt', 'is', null),
				eb('o.expireAt', '>', now),
			]))
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