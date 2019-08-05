'use strict';

module.exports = function (module) {
	var helpers = require('./helpers');

	module.setObject = async function (key, data) {
		if (!key || !data) {
			return;
		}

		if (data.hasOwnProperty('')) {
			delete data[''];
		}

		await module.transaction(async function (client) {
			const dataString = JSON.stringify(data);
			async function setOne(key) {
				await helpers.ensureLegacyObjectType(client, key, 'hash');
				await client.query({
					name: 'setObject',
					text: `
	INSERT INTO "legacy_hash" ("_key", "data")
	VALUES ($1::TEXT, $2::TEXT::JSONB)
	ON CONFLICT ("_key")
	DO UPDATE SET "data" = "legacy_hash"."data" || $2::TEXT::JSONB`,
					values: [key, dataString],
				});
			}
			if (Array.isArray(key)) {
				await Promise.all(key.map(k => setOne(k)));
			} else {
				await setOne(key);
			}
		});
	};

	module.setObjectField = async function (key, field, value) {
		if (!field) {
			return;
		}

		await module.transaction(async function (client) {
			const valueString = JSON.stringify(value);
			async function setOne(key) {
				await helpers.ensureLegacyObjectType(client, key, 'hash');
				await client.query({
					name: 'setObjectField',
					text: `
	INSERT INTO "legacy_hash" ("_key", "data")
	VALUES ($1::TEXT, jsonb_build_object($2::TEXT, $3::TEXT::JSONB))
	ON CONFLICT ("_key")
	DO UPDATE SET "data" = jsonb_set("legacy_hash"."data", ARRAY[$2::TEXT], $3::TEXT::JSONB)`,
					values: [key, field, valueString],
				});
			}

			if (Array.isArray(key)) {
				await Promise.all(key.map(k => setOne(k)));
			} else {
				await setOne(key);
			}
		});
	};

	module.getObject = async function (key) {
		if (!key) {
			return null;
		}

		const res = await module.pool.query({
			name: 'getObject',
			text: `
SELECT h."data"
  FROM "legacy_object_live" o
 INNER JOIN "legacy_hash" h
         ON o."_key" = h."_key"
        AND o."type" = h."type"
 WHERE o."_key" = $1::TEXT
 LIMIT 1`,
			values: [key],
		});

		return res.rows.length ? res.rows[0].data : null;
	};

	module.getObjects = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const res = await module.pool.query({
			name: 'getObjects',
			text: `
SELECT h."data"
  FROM UNNEST($1::TEXT[]) WITH ORDINALITY k("_key", i)
  LEFT OUTER JOIN "legacy_object_live" o
               ON o."_key" = k."_key"
  LEFT OUTER JOIN "legacy_hash" h
               ON o."_key" = h."_key"
              AND o."type" = h."type"
 ORDER BY k.i ASC`,
			values: [keys],
		});

		return res.rows.map(row => row.data);
	};

	module.getObjectField = async function (key, field) {
		if (!key) {
			return null;
		}

		const res = await module.pool.query({
			name: 'getObjectField',
			text: `
SELECT h."data"->>$2::TEXT f
  FROM "legacy_object_live" o
 INNER JOIN "legacy_hash" h
         ON o."_key" = h."_key"
        AND o."type" = h."type"
 WHERE o."_key" = $1::TEXT
 LIMIT 1`,
			values: [key, field],
		});

		return res.rows.length ? res.rows[0].f : null;
	};

	module.getObjectFields = async function (key, fields) {
		if (!key) {
			return null;
		}

		const res = await module.pool.query({
			name: 'getObjectFields',
			text: `
SELECT (SELECT jsonb_object_agg(f, d."value")
          FROM UNNEST($2::TEXT[]) f
          LEFT OUTER JOIN jsonb_each(h."data") d
                       ON d."key" = f) d
  FROM "legacy_object_live" o
 INNER JOIN "legacy_hash" h
         ON o."_key" = h."_key"
        AND o."type" = h."type"
 WHERE o."_key" = $1::TEXT`,
			values: [key, fields],
		});

		if (res.rows.length) {
			return res.rows[0].d;
		}

		var obj = {};
		fields.forEach(function (f) {
			obj[f] = null;
		});

		return obj;
	};

	module.getObjectsFields = async function (keys, fields) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const res = await module.pool.query({
			name: 'getObjectsFields',
			text: `
SELECT (SELECT jsonb_object_agg(f, d."value")
          FROM UNNEST($2::TEXT[]) f
          LEFT OUTER JOIN jsonb_each(h."data") d
                       ON d."key" = f) d
  FROM UNNEST($1::text[]) WITH ORDINALITY k("_key", i)
  LEFT OUTER JOIN "legacy_object_live" o
               ON o."_key" = k."_key"
  LEFT OUTER JOIN "legacy_hash" h
               ON o."_key" = h."_key"
              AND o."type" = h."type"
 ORDER BY k.i ASC`,
			values: [keys, fields],
		});

		return res.rows.map(row => row.d);
	};

	module.getObjectKeys = async function (key) {
		if (!key) {
			return;
		}

		const res = await module.pool.query({
			name: 'getObjectKeys',
			text: `
SELECT ARRAY(SELECT jsonb_object_keys(h."data")) k
  FROM "legacy_object_live" o
 INNER JOIN "legacy_hash" h
         ON o."_key" = h."_key"
        AND o."type" = h."type"
 WHERE o."_key" = $1::TEXT
 LIMIT 1`,
			values: [key],
		});

		return res.rows.length ? res.rows[0].k : [];
	};

	module.getObjectValues = async function (key) {
		const data = await module.getObject(key);
		return data ? Object.values(data) : [];
	};

	module.isObjectField = async function (key, field) {
		if (!key) {
			return;
		}

		const res = await module.pool.query({
			name: 'isObjectField',
			text: `
SELECT (h."data" ? $2::TEXT AND h."data"->>$2::TEXT IS NOT NULL) b
  FROM "legacy_object_live" o
 INNER JOIN "legacy_hash" h
         ON o."_key" = h."_key"
        AND o."type" = h."type"
 WHERE o."_key" = $1::TEXT
 LIMIT 1`,
			values: [key, field],
		});

		return res.rows.length ? res.rows[0].b : false;
	};

	module.isObjectFields = async function (key, fields) {
		if (!key) {
			return;
		}

		const data = await module.getObjectFields(key, fields);
		if (!data) {
			return fields.map(() => false);
		}
		return fields.map(field => data.hasOwnProperty(field) && data[field] !== null);
	};

	module.deleteObjectField = async function (key, field) {
		await module.deleteObjectFields(key, [field]);
	};

	module.deleteObjectFields = async function (key, fields) {
		if (!key || !Array.isArray(fields) || !fields.length) {
			return;
		}

		await module.pool.query({
			name: 'deleteObjectFields',
			text: `
UPDATE "legacy_hash"
   SET "data" = COALESCE((SELECT jsonb_object_agg("key", "value")
                            FROM jsonb_each("data")
                           WHERE "key" <> ALL ($2::TEXT[])), '{}')
 WHERE "_key" = $1::TEXT`,
			values: [key, fields],
		});
	};

	module.incrObjectField = async function (key, field) {
		return await module.incrObjectFieldBy(key, field, 1);
	};

	module.decrObjectField = async function (key, field) {
		return await module.incrObjectFieldBy(key, field, -1);
	};

	module.incrObjectFieldBy = async function (key, field, value) {
		value = parseInt(value, 10);

		if (!key || isNaN(value)) {
			return null;
		}

		return await module.transaction(async function (client) {
			if (Array.isArray(key)) {
				await helpers.ensureLegacyObjectsType(client, key, 'hash');
			} else {
				await helpers.ensureLegacyObjectType(client, key, 'hash');
			}

			const res = await client.query(Array.isArray(key) ? {
				name: 'incrObjectFieldByMulti',
				text: `
INSERT INTO "legacy_hash" ("_key", "data")
SELECT UNNEST($1::TEXT[]), jsonb_build_object($2::TEXT, $3::NUMERIC)
ON CONFLICT ("_key")
DO UPDATE SET "data" = jsonb_set("legacy_hash"."data", ARRAY[$2::TEXT], to_jsonb(COALESCE(("legacy_hash"."data"->>$2::TEXT)::NUMERIC, 0) + $3::NUMERIC))
RETURNING ("data"->>$2::TEXT)::NUMERIC v`,
				values: [key, field, value],
			} : {
				name: 'incrObjectFieldBy',
				text: `
INSERT INTO "legacy_hash" ("_key", "data")
VALUES ($1::TEXT, jsonb_build_object($2::TEXT, $3::NUMERIC))
ON CONFLICT ("_key")
DO UPDATE SET "data" = jsonb_set("legacy_hash"."data", ARRAY[$2::TEXT], to_jsonb(COALESCE(("legacy_hash"."data"->>$2::TEXT)::NUMERIC, 0) + $3::NUMERIC))
RETURNING ("data"->>$2::TEXT)::NUMERIC v`,
				values: [key, field, value],
			});
			return Array.isArray(key) ? res.rows.map(r => parseFloat(r.v)) : parseFloat(res.rows[0].v);
		});
	};
};
