'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

	module.setObject = async function (key, data) {
		if (!key || !data) {
			return;
		}

		if (Array.isArray(key)) {
			return await Promise.all(key.map(k => module.setObject(k, data)));
		}

		await helpers.withTransaction(module, key, 'hash', async (client, dialect) => {
			const fields = Object.keys(data);
			const rows = fields.map(field => ({
				_key: key,
				field: field,
				value: data[field] !== null && data[field] !== undefined ? String(data[field]) : null,
			}));
			await helpers.upsertMultiple(client, 'legacy_hash', rows, ['_key', 'field'], ['value'], dialect);
		});
	};

	module.setObjectBulk = async function (...args) {
		let pairs;
		if (Array.isArray(args[0]) && args[0].length > 0 && Array.isArray(args[0][0])) {
			pairs = args[0];
		} else if (Array.isArray(args[0]) && Array.isArray(args[1])) {
			pairs = args[0].map((key, i) => [key, args[1][i]]);
		} else {
			pairs = args;
		}

		if (!pairs.length) {
			return;
		}

		await helpers.withTransaction(module, null, null, async (client, dialect) => {
			// Collect all unique keys and ensure types
			const uniqueKeys = [...new Set(pairs.filter(p => p[0]).map(p => p[0]))];
			await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'hash', dialect);

			// Collect all rows across all pairs
			const allRows = [];
			for (const [key, data] of pairs) {
				if (!key || !data) continue;

				const fields = Object.keys(data);
				for (const field of fields) {
					allRows.push({
						_key: key,
						field: field,
						value: data[field] !== null && data[field] !== undefined ? String(data[field]) : null,
					});
				}
			}

			if (allRows.length) {
				await helpers.upsertMultiple(client, 'legacy_hash', allRows, ['_key', 'field'], ['value'], dialect);
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

		await helpers.withTransaction(module, key, 'hash', async (client, dialect) => {
			await helpers.upsert(client, 'legacy_hash', {
				_key: key,
				field: field,
				value: strValue,
			}, ['_key', 'field'], { value: strValue }, dialect);
		});
	};

	module.getObject = async function (key, fields) {
		if (!key) {
			return null;
		}

		let query = helpers.createHashQuery(module.db, module.dialect)
			.select(['h.field', 'h.value'])
			.where('o._key', '=', key);

		if (fields && fields.length) {
			query = query.where('h.field', 'in', fields);
		}

		const result = await query.execute();

		if (!result.length) {
			return null;
		}

		const data = {};
		result.forEach((row) => {
			data[row.field] = row.value;
		});
		return data;
	};

	module.getObjects = async function (keys, fields) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		let query = helpers.createHashQuery(module.db, module.dialect)
			.select(['h._key', 'h.field', 'h.value'])
			.where('o._key', 'in', keys);

		if (fields && fields.length) {
			query = query.where('h.field', 'in', fields);
		}

		const result = await query.execute();

		// Build a map of key -> {field: value}
		const map = {};
		keys.forEach((k) => { map[k] = null; });

		result.forEach((row) => {
			if (!map[row._key]) {
				map[row._key] = {};
			}
			map[row._key][row.field] = row.value;
		});

		// If specific fields were requested, ensure all fields are present with null for missing
		if (fields && fields.length) {
			return keys.map((k) => {
				if (!map[k]) return null;
				const obj = {};
				fields.forEach((f) => {
					obj[f] = Object.prototype.hasOwnProperty.call(map[k], f) ? map[k][f] : null;
				});
				return obj;
			});
		}

		return keys.map(k => map[k]);
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
			return {};
		}

		const data = await module.getObject(key, fields);

		// Ensure all requested fields are present (set to null if missing)
		const result = {};
		fields.forEach((f) => {
			result[f] = data && Object.prototype.hasOwnProperty.call(data, f) ? data[f] : null;
		});
		return result;
	};

	module.getObjectsFields = async function (keys, fields) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		// When fields is empty array, return all fields
		if (!Array.isArray(fields) || !fields.length) {
			return await module.getObjects(keys);
		}

		const objects = await module.getObjects(keys, fields);

		return objects.map((obj) => {
			const result = {};
			fields.forEach((f) => {
				result[f] = obj && Object.prototype.hasOwnProperty.call(obj, f) ? obj[f] : null;
			});
			return result;
		});
	};

	module.getObjectKeys = async function (key) {
		if (!key) {
			return [];
		}

		const result = await helpers.createHashQuery(module.db, module.dialect)
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

		const result = await helpers.createHashQuery(module.db, module.dialect)
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

		const result = await helpers.createHashQuery(module.db, module.dialect)
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

		return await helpers.withTransaction(module, key, 'hash', async (client, dialect) => {
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
			}, ['_key', 'field'], { value: strValue }, dialect);

			return newValue;
		});
	};

	module.incrObjectFieldByBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}

		// Note: This requires sequential processing because each increment depends on the current value
		// We batch the type ensures but process increments sequentially
		await helpers.withTransaction(module, null, null, async (client, dialect) => {
			const uniqueKeys = [...new Set(data.filter(d => d[0]).map(d => d[0]))];
			await helpers.ensureLegacyObjectsType(client, uniqueKeys, 'hash', dialect);

			// Get all current values in one query
			const keyFieldPairs = [];
			for (const item of data) {
				const [key, fieldValueObj] = item;
				if (!key || !fieldValueObj) continue;
				for (const field of Object.keys(fieldValueObj)) {
					keyFieldPairs.push({ key, field });
				}
			}

			// Query all existing values at once
			const existingValues = {};
			if (keyFieldPairs.length) {
				const results = await client.selectFrom('legacy_hash')
					.select(['_key', 'field', 'value'])
					.where(eb => eb.or(
						keyFieldPairs.map(p => eb.and([
							eb('_key', '=', p.key),
							eb('field', '=', p.field),
						]))
					))
					.execute();

				results.forEach((r) => {
					existingValues[`${r._key}:${r.field}`] = r.value;
				});
			}

			// Build all rows for upsert
			const rows = [];
			for (const item of data) {
				const [key, fieldValueObj] = item;
				if (!key || !fieldValueObj) continue;

				for (const [field, incValue] of Object.entries(fieldValueObj)) {
					const increment = parseInt(incValue, 10) || 0;
					const existingKey = `${key}:${field}`;
					const currentValue = existingValues[existingKey] ? parseFloat(existingValues[existingKey]) || 0 : 0;
					const newValue = currentValue + increment;

					rows.push({
						_key: key,
						field: field,
						value: String(newValue),
					});
				}
			}

			if (rows.length) {
				await helpers.upsertMultiple(client, 'legacy_hash', rows, ['_key', 'field'], ['value'], dialect);
			}
		});
	};
};