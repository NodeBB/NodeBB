'use strict';

// Type-preserving storage for `legacy_hash`.
//
// `value` is always TEXT (so plain SQL inspection still works), and
// `value_type` is a one-character tag we use to recover the original JS
// scalar type on read:
//   'n'   → number
//   'b'   → boolean
//   NULL  → string (also the legacy default for any pre-existing row)
//
// Mirrors NodeBB's pg-adapter type round-trip without needing a per-field
// allowlist or a JSON codec.
function toRow(_key, field, value) {
	if (value === null || value === undefined) {
		return { _key, field, value: null, value_type: null };
	}
	if (typeof value === 'number') {
		return { _key, field, value: String(value), value_type: 'n' };
	}
	if (typeof value === 'boolean') {
		return { _key, field, value: value ? '1' : '0', value_type: 'b' };
	}
	return { _key, field, value: String(value), value_type: null };
}

function decode(value, valueType) {
	if (value === null || value === undefined) return null;
	if (valueType === 'n') return Number(value);
	if (valueType === 'b') return value === '1' || value === 'true';
	return value;
}

const VALUE_COLS = ['value', 'value_type'];

module.exports = function (module) {
	const { helpers } = module;

	module.setObject = async function (key, data) {
		if (!key || !data) {
			return;
		}

		if (Array.isArray(key)) {
			return await module.setObjectBulk(key.map(k => [k, data]));
		}

		await helpers.withTransaction(key, 'hash', async (client) => {
			const rows = Object.entries(data).map(([field, value]) => toRow(key, field, value));
			await helpers.upsertMultiple(
				client, 'legacy_hash', rows, ['_key', 'field'], VALUE_COLS
			);
		});
	};

	module.setObjectBulk = async function (...args) {
		const pairs =
			Array.isArray(args[0]) && args[0].length > 0 && Array.isArray(args[0][0]) ?
				args[0] :
				Array.isArray(args[0]) && Array.isArray(args[1]) ?
					args[0].map((key, i) => [key, args[1][i]]) :
					args;

		if (!pairs.length) {
			return;
		}

		await helpers.withTransaction(null, null, async (client) => {
			const uniqueKeys = [
				...new Set(pairs.filter(([key]) => key).map(([key]) => key)),
			];
			await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'hash');

			const allRows = pairs
				.filter(([key, data]) => key && data)
				.flatMap(([key, data]) =>
					Object.entries(data).map(([field, value]) => toRow(key, field, value)));

			if (allRows.length) {
				await helpers.upsertMultiple(
					client, 'legacy_hash', allRows, ['_key', 'field'], VALUE_COLS
				);
			}
		});
	};

	module.setObjectField = async function (key, field, value) {
		if (!key || !field) {
			return;
		}

		if (Array.isArray(key)) {
			return await helpers.withTransaction(null, null, async (client) => {
				const uniqueKeys = [...new Set(key.filter(Boolean))];
				await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'hash');
				const rows = uniqueKeys.map(k => toRow(k, field, value));
				await helpers.upsertMultiple(
					client, 'legacy_hash', rows, ['_key', 'field'], VALUE_COLS
				);
			});
		}

		const row = toRow(key, field, value);

		await helpers.withTransaction(key, 'hash', async (client) => {
			await helpers.upsert(
				client, 'legacy_hash', row, ['_key', 'field'],
				{ value: row.value, value_type: row.value_type }
			);
		});
	};

	module.getObject = async function (key, fields) {
		if (!key) {
			return null;
		}

		// Normalize fields to array (handle string like 'field' vs ['field'])
		let normalizedFields = fields;
		if (fields && !Array.isArray(fields)) {
			normalizedFields = [fields];
		}

		let query = helpers
			.createHashQuery()
			.select(['h.field', 'h.value', 'h.value_type'])
			.where('o._key', '=', key);

		if (normalizedFields && normalizedFields.length) {
			query = query.where('h.field', 'in', normalizedFields);
		}

		const result = await query.execute();

		if (!result.length) {
			// If fields were specified, return object with null values (matches postgres behavior)
			if (normalizedFields && normalizedFields.length) {
				return Object.fromEntries(normalizedFields.map(f => [f, null]));
			}
			return null;
		}

		const obj = Object.fromEntries(
			result.map(({ field, value, value_type }) => [field, decode(value, value_type)])
		);

		// If fields were specified, ensure all requested fields are present
		if (normalizedFields && normalizedFields.length) {
			return Object.fromEntries(
				normalizedFields.map(f => [f, obj[f] ?? null])
			);
		}

		return obj;
	};

	module.getObjects = async function (keys, fields) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		// Normalize fields to array (handle string like 'field' vs ['field'])
		let normalizedFields = fields;
		if (fields && !Array.isArray(fields)) {
			normalizedFields = [fields];
		}

		let query = helpers
			.createHashQuery()
			.select(['h._key', 'h.field', 'h.value', 'h.value_type'])
			.where('o._key', 'in', keys);

		if (normalizedFields && normalizedFields.length) {
			query = query.where('h.field', 'in', normalizedFields);
		}

		const result = await query.execute();

		// Bucket rows by `_key` in O(N) — the previous spread-based reduce was
		// O(N²) (entire accumulator copied per row).
		const map = {};
		for (const { _key, field, value, value_type } of result) {
			if (!map[_key]) map[_key] = {};
			map[_key][field] = decode(value, value_type);
		}

		// If specific fields were requested, return object with all fields (null for missing)
		if (normalizedFields?.length) {
			return keys.map(k =>
				Object.fromEntries(
					normalizedFields.map(f => [f, map[k]?.[f] ?? null])
				));
		}

		return keys.map(k => map[k] || null);
	};

	module.getObjectField = async function (key, field) {
		if (!key || !field || Array.isArray(field)) {
			return null;
		}

		const data = await module.getObject(key, [field]);
		return data ? data[field] : null;
	};

	module.getObjectFields = async function (key, fields) {
		if (!key) {
			return null;
		}
		if (!Array.isArray(fields) || !fields.length) {
			// Match postgres behavior: return full object when no fields specified
			return await module.getObject(key);
		}
		// Single SQL: LEFT JOIN the requested fields against legacy_hash.
		const lookup = fields.map(f => ({ _key: key, field: String(f) }));
		const rows = await helpers.fetchOrderedRows(
			module.db, 'legacy_hash', lookup, ['_key', 'field'], VALUE_COLS,
			{ notExpired: true },
		);
		return Object.fromEntries(fields.map((f, i) => [f, decode(rows[i].value, rows[i].value_type)]));
	};

	module.getObjectsFields = async function (keys, fields) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		// Delegate to getObjects - it handles fields correctly
		return await module.getObjects(keys, fields);
	};

	module.getObjectKeys = async function (key) {
		if (!key) {
			return [];
		}

		const result = await helpers
			.createHashQuery()
			.select('h.field')
			.where('o._key', '=', key)
			.execute();

		return result.map(r => r.field);
	};

	module.getObjectValues = async function (key) {
		const data = await module.getObject(key);
		return data ? Object.values(data) : [];
	};

	module.isObjectField = async function (key, field) {
		if (!key || !field) {
			return false;
		}

		const result = await helpers
			.createHashQuery()
			.select('h.field')
			.where('o._key', '=', key)
			.where('h.field', '=', field)
			.limit(1)
			.executeTakeFirst();

		return !!result;
	};

	module.isObjectFields = async function (key, fields) {
		if (!key || !Array.isArray(fields) || !fields.length) {
			return fields ? fields.map(() => false) : [];
		}
		// LEFT JOIN each requested field against legacy_hash; SQL returns one
		// row per input in order, with `field` non-null on a match. No JS Set,
		// no input-order remap.
		const lookup = fields.map(f => ({ _key: key, field: String(f) }));
		const rows = await helpers.fetchOrderedRows(
			module.db, 'legacy_hash', lookup, ['_key', 'field'], ['field'],
			{ notExpired: true },
		);
		return rows.map(r => r.field != null);
	};

	module.deleteObjectField = async function (key, field) {
		if (!key || !field || (Array.isArray(field) && !field.length)) {
			return;
		}

		if (Array.isArray(field)) {
			return await module.deleteObjectFields(key, field);
		}

		if (Array.isArray(key)) {
			await module.db
				.deleteFrom('legacy_hash')
				.where('_key', 'in', key)
				.where('field', '=', field)
				.execute();
			return;
		}

		await module.db
			.deleteFrom('legacy_hash')
			.where('_key', '=', key)
			.where('field', '=', field)
			.execute();
	};

	module.deleteObjectFields = async function (key, fields) {
		if (!key || !Array.isArray(fields) || !fields.length) {
			return;
		}

		if (Array.isArray(key)) {
			if (!key.length) return;
			await module.db
				.deleteFrom('legacy_hash')
				.where('_key', 'in', key)
				.where('field', 'in', fields)
				.execute();
			return;
		}

		await module.db
			.deleteFrom('legacy_hash')
			.where('_key', '=', key)
			.where('field', 'in', fields)
			.execute();
	};

	module.incrObjectField = async function (key, field) {
		return await module.incrObjectFieldBy(key, field, 1);
	};

	module.decrObjectField = async function (key, field) {
		return await module.incrObjectFieldBy(key, field, -1);
	};

	module.incrObjectFieldBy = async function (key, field, value) {
		if (!key || !field) {
			return null;
		}
		value = parseInt(value, 10);
		if (isNaN(value)) {
			return null;
		}

		if (Array.isArray(key)) {
			return await helpers.withTransaction(null, null, async (client) => {
				const uniqueKeys = [...new Set(key.filter(Boolean))];
				await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'hash');
				const rows = uniqueKeys.map(k => ({ _key: k, field, value: String(value), value_type: 'n' }));
				await helpers.upsertAddTypedMultiple(client, 'legacy_hash', rows, ['_key', 'field']);
				const fetched = await helpers.fetchOrderedRows(
					client, 'legacy_hash',
					key.map(k => ({ _key: k, field })),
					['_key', 'field'], ['value'],
				);
				return fetched.map(r => Number(r.value));
			});
		}

		// Atomic add via UPSERT-with-arithmetic — no SELECT-then-UPDATE race.
		// Dialect dispatch (ON DUPLICATE KEY vs ON CONFLICT, VALUES() vs
		// excluded., per-dialect cast types) lives in helpers.upsertAddTyped.
		return await helpers.withTransaction(key, 'hash', async (client) => {
			const row = { _key: key, field, value: String(value), value_type: 'n' };
			return await helpers.upsertAddTyped(client, 'legacy_hash', row, ['_key', 'field']);
		});
	};

	module.incrObjectFieldByBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}

		await helpers.withTransaction(null, null, async (client) => {
			const uniqueKeys = [
				...new Set(data.filter(([key]) => key).map(([key]) => key)),
			];
			await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'hash');

			// Pre-fold deltas — same key+field appearing twice in `data`
			// must collapse to a single insert row (ON CONFLICT can only
			// update each conflict target once per statement). Nested Map
			// keeps composite lookups O(1) without a delimiter.
			const folded = new Map();
			for (const [key, fieldValueObj] of data) {
				if (!key || !fieldValueObj) continue;
				let inner = folded.get(key);
				if (!inner) { inner = new Map(); folded.set(key, inner); }
				for (const [field, incValue] of Object.entries(fieldValueObj)) {
					const delta = parseInt(incValue, 10) || 0;
					inner.set(field, (inner.get(field) || 0) + delta);
				}
			}
			const rows = [];
			for (const [key, inner] of folded) {
				for (const [field, delta] of inner) {
					rows.push({ _key: key, field, value: String(delta), value_type: 'n' });
				}
			}

			await helpers.upsertAddTypedMultiple(client, 'legacy_hash', rows, ['_key', 'field']);
		});
	};
};
