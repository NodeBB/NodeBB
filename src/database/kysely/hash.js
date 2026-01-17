'use strict';

module.exports = function (module) {
	const { helpers } = module;

	module.setObject = async function (key, data) {
		if (!key || !data) {
			return;
		}

		if (Array.isArray(key)) {
			return await Promise.all(key.map(k => module.setObject(k, data)));
		}

		await helpers.withTransaction(key, 'hash', async (client) => {
			const rows = Object.entries(data).map(([field, value]) => ({
				_key: key,
				field,
				value: value !== null && value !== undefined ? String(value) : null,
			}));
			await helpers.upsertMultiple(client, 'legacy_hash', rows, ['_key', 'field'], ['value']);
		});
	};

	module.setObjectBulk = async function (...args) {
		const pairs = Array.isArray(args[0]) && args[0].length > 0 && Array.isArray(args[0][0]) ?
			args[0] :
			Array.isArray(args[0]) && Array.isArray(args[1]) ?
				args[0].map((key, i) => [key, args[1][i]]) :
				args;

		if (!pairs.length) {
			return;
		}

		await helpers.withTransaction(null, null, async (client) => {
			// Collect all unique keys and ensure types
			const uniqueKeys = [...new Set(pairs.filter(([key]) => key).map(([key]) => key))];
			await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'hash');

			// Collect all rows across all pairs using flatMap
			const allRows = pairs
				.filter(([key, data]) => key && data)
				.flatMap(([key, data]) => Object.entries(data).map(([field, value]) => ({
					_key: key,
					field,
					value: value !== null && value !== undefined ? String(value) : null,
				})));

			if (allRows.length) {
				await helpers.upsertMultiple(client, 'legacy_hash', allRows, ['_key', 'field'], ['value']);
			}
		});
	};

	module.setObjectField = async function (key, field, value) {
		if (!key || !field) {
			return;
		}

		if (Array.isArray(key)) {
			return await Promise.all(key.map(k => module.setObjectField(k, field, value)));
		}

		const strValue = value !== null && value !== undefined ? String(value) : null;

		await helpers.withTransaction(key, 'hash', async (client) => {
			await helpers.upsert(client, 'legacy_hash', {
				_key: key,
				field: field,
				value: strValue,
			}, ['_key', 'field'], { value: strValue });
		});
	};

	module.getObject = async function (key, fields) {
		if (!key) {
			return null;
		}

		let query = helpers.createHashQuery()
			.select(['h.field', 'h.value'])
			.where('o._key', '=', key);

		if (fields && fields.length) {
			query = query.where('h.field', 'in', fields);
		}

		const result = await query.execute();

		if (!result.length) {
			// If fields were specified, return object with null values (matches postgres behavior)
			if (fields && fields.length) {
				return Object.fromEntries(fields.map(f => [f, null]));
			}
			return null;
		}

		// Build result object
		const obj = Object.fromEntries(result.map(({ field, value }) => [field, value]));

		// If fields were specified, ensure all requested fields are present
		if (fields && fields.length) {
			return Object.fromEntries(fields.map(f => [f, obj[f] ?? null]));
		}

		return obj;
	};

	module.getObjects = async function (keys, fields) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		let query = helpers.createHashQuery()
			.select(['h._key', 'h.field', 'h.value'])
			.where('o._key', 'in', keys);

		if (fields && fields.length) {
			query = query.where('h.field', 'in', fields);
		}

		const result = await query.execute();

		// Build a map of key -> {field: value}
		const map = result.reduce((acc, { _key, field, value }) => ({
			...acc,
			[_key]: { ...(acc[_key] || {}), [field]: value },
		}), {});

		// If specific fields were requested, return object with all fields (null for missing)
		// This matches postgres behavior where missing keys return {field1: null, field2: null, ...}
		if (fields?.length) {
			return keys.map(k => Object.fromEntries(
				fields.map(f => [f, map[k]?.[f] ?? null])
			));
		}

		// Without fields, return the full object or null for missing keys
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

		const data = await module.getObject(key, fields);

		// Ensure all requested fields are present (set to null if missing)
		return Object.fromEntries(fields.map(f => [f, data?.[f] ?? null]));
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

		const result = await helpers.createHashQuery()
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

		const result = await helpers.createHashQuery()
			.select('h.value')
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

		const result = await helpers.createHashQuery()
			.select('h.field')
			.where('o._key', '=', key)
			.where('h.field', 'in', fields)
			.execute();

		const existingFields = new Set(result.map(r => r.field));
		return fields.map(f => existingFields.has(f));
	};

	module.deleteObjectField = async function (key, field) {
		if (!key || !field || (Array.isArray(field) && !field.length)) {
			return;
		}

		if (Array.isArray(key)) {
			return await Promise.all(key.map(k => module.deleteObjectField(k, field)));
		}

		if (Array.isArray(field)) {
			return await module.deleteObjectFields(key, field);
		}

		await module.db.deleteFrom('legacy_hash')
			.where('_key', '=', key)
			.where('field', '=', field)
			.execute();
	};

	module.deleteObjectFields = async function (key, fields) {
		if (!key || !Array.isArray(fields) || !fields.length) {
			return;
		}

		if (Array.isArray(key)) {
			return await Promise.all(key.map(k => module.deleteObjectFields(k, fields)));
		}

		await module.db.deleteFrom('legacy_hash')
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
			return await Promise.all(key.map(k => module.incrObjectFieldBy(k, field, value)));
		}

		return await helpers.withTransaction(key, 'hash', async (client) => {
			const current = await client.selectFrom('legacy_hash')
				.select('value')
				.where('_key', '=', key)
				.where('field', '=', field)
				.executeTakeFirst();

			const currentValue = current ? parseFloat(current.value) || 0 : 0;
			const newValue = currentValue + value;
			const strValue = String(newValue);

			await helpers.upsert(client, 'legacy_hash', {
				_key: key,
				field: field,
				value: strValue,
			}, ['_key', 'field'], { value: strValue });

			return newValue;
		});
	};

	module.incrObjectFieldByBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}

		// Note: This requires fetching current values first, then calculating new values
		await helpers.withTransaction(null, null, async (client) => {
			const uniqueKeys = [...new Set(data.filter(([key]) => key).map(([key]) => key))];
			await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'hash');

			// Get all key-field pairs using flatMap
			const keyFieldPairs = data
				.filter(([key, fieldValueObj]) => key && fieldValueObj)
				.flatMap(([key, fieldValueObj]) => Object.keys(fieldValueObj).map(field => ({ key, field })));

			// Query all existing values at once
			const existingValues = keyFieldPairs.length ?
				Object.fromEntries(
					(await client.selectFrom('legacy_hash')
						.select(['_key', 'field', 'value'])
						.where(eb => eb.or(
							keyFieldPairs.map(({ key, field }) => eb.and([
								eb('_key', '=', key),
								eb('field', '=', field),
							]))
						))
						.execute())
						.map(({ _key, field, value }) => [`${_key}:${field}`, value])
				) : {};

			// Build all rows for upsert using flatMap
			const rows = data
				.filter(([key, fieldValueObj]) => key && fieldValueObj)
				.flatMap(([key, fieldValueObj]) => Object.entries(fieldValueObj).map(([field, incValue]) => {
					const increment = parseInt(incValue, 10) || 0;
					const existingKey = `${key}:${field}`;
					const currentValue = existingValues[existingKey] ?
						parseFloat(existingValues[existingKey]) || 0 : 0;
					return {
						_key: key,
						field,
						value: String(currentValue + increment),
					};
				}));

			if (rows.length) {
				await helpers.upsertMultiple(client, 'legacy_hash', rows, ['_key', 'field'], ['value']);
			}
		});
	};
};