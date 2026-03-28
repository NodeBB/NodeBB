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
		text: `
DELETE FROM "legacy_object"
 WHERE "expireAt" IS NOT NULL
   AND "expireAt" <= CURRENT_TIMESTAMP`,
	});

	const res = await db.query({
		name: 'ensureLegacyObjectType_upsert',
		text: `
INSERT INTO "legacy_object" ("_key", "type")
VALUES ($1::TEXT, $2::TEXT::LEGACY_OBJECT_TYPE)
    ON CONFLICT ("_key")
    DO UPDATE SET "type" = "legacy_object"."type"
    RETURNING "type"`,
		values: [key, type],
	});

	if (res.rows[0].type !== type) {
		throw new Error(`database: cannot insert ${JSON.stringify(key)} as ${type} because it already exists as ${res.rows[0].type}`);
	}
};

helpers.ensureLegacyObjectsType = async function (db, keys, type) {
	keys = [...new Set(keys)];

	await db.query({
		name: 'ensureLegacyObjectTypeBefore',
		text: `
DELETE FROM "legacy_object"
 WHERE "expireAt" IS NOT NULL
   AND "expireAt" <= CURRENT_TIMESTAMP`,
	});

	const res = await db.query({
		name: 'ensureLegacyObjectsType_upsert',
		text: `
INSERT INTO "legacy_object" ("_key", "type")
SELECT k, $2::TEXT::LEGACY_OBJECT_TYPE
  FROM UNNEST($1::TEXT[]) k
    ON CONFLICT ("_key")
    DO UPDATE SET "type" = "legacy_object"."type"
    RETURNING "_key", "type"`,
		values: [keys, type],
	});

	const invalid = res.rows.filter(r => r.type !== type);

	if (invalid.length) {
		const parts = invalid.map(r => `${JSON.stringify(r._key)} is ${r.type}`);
		throw new Error(`database: cannot insert multiple objects as ${type} because they already exist: ${parts.join(', ')}`);
	}
};

helpers.noop = function () {};
