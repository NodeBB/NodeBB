'use strict';

const helpers = module.exports;

helpers.valueToString = function (value) {
	return String(value);
};

helpers.removeDuplicateValues = function (values, ...others) {
	for (let i = 0; i < values.length; i++) {
		if (values.lastIndexOf(values[i]) !== i) {
			values.splice(i, 1);
			for (let j = 0; j < others.length; j++) {
				others[j].splice(i, 1);
			}
			i -= 1;
		}
	}
};

helpers.ensureLegacyObjectType = async function (db, key, type) {
	await db.query({
		name: 'ensureLegacyObjectTypeBefore',
		sql: `
			DELETE FROM \`legacy_object\`
			WHERE \`expireAt\` IS NOT NULL
			AND \`expireAt\` <= NOW()`
	});

	await db.query({
		name: 'ensureLegacyObjectType1',
		sql: `
			INSERT IGNORE INTO \`legacy_object\` (\`_key\`, \`type\`)
			VALUES (?, ?)`,
		values: [key, type],
	});

	const res = await db.query({
		name: 'ensureLegacyObjectType2',
		sql: `
			SELECT \`type\`
			FROM \`legacy_object_live\`
			WHERE \`_key\` = ?`,
		values: [key],
	});

	if (res[0][0].type !== type) {
		throw new Error(`database: cannot insert ${JSON.stringify(key)} as ${type} because it already exists as ${res.rows[0].type}`);
	}
};

helpers.ensureLegacyObjectsType = async function (db, keys, type) {
	await db.query({
		name: 'ensureLegacyObjectTypeBefore',
		sql: `
			DELETE FROM \`legacy_object\`
			WHERE \`expireAt\` IS NOT NULL
			AND \`expireAt\` <= NOW()`
	});

	await db.query({
		name: 'ensureLegacyObjectsType1',
		sql: `
			INSERT IGNORE INTO \`legacy_object\` (\`_key\`, \`type\`)
			VALUES ${keys.map(() => '(?, ?)').join(', ')}`,
		values: keys.flatMap(k => [k, type]),
	});

	const res = await db.query({
		name: 'ensureLegacyObjectsType2',
		sql: `
			SELECT \`_key\`, \`type\`
			FROM \`legacy_object_live\`
			WHERE \`_key\` IN (${keys.map(() => '?').join(', ')})`,
		values: keys,
	});

	const invalid = res.rows.filter(r => r.type !== type);

	if (invalid.length) {
		const parts = invalid.map(r => `${JSON.stringify(r._key)} is ${r.type}`);
		throw new Error(`database: cannot insert multiple objects as ${type} because they already exist: ${parts.join(', ')}`);
	}

	const missing = keys.filter(k => !res.rows.some(r => r._key === k));

	if (missing.length) {
		throw new Error(`database: failed to insert keys for objects: ${JSON.stringify(missing)}`);
	}
};

helpers.noop = function () { };
