'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

	module.setObject = async function (key, data) {
		if (!key || !data) {
			return;
		}

		if (data.hasOwnProperty('')) {
			delete data[''];
		}
		if (!Object.keys(data).length) {
			return;
		}
		await module.transaction(async (client) => {
			const dataString = JSON.stringify(data);

			if (Array.isArray(key)) {
				await helpers.ensureLegacyObjectsType(client, key, 'hash');
				await client.query({
					name: 'setObjectKeys',
					text: `
	INSERT INTO "legacy_hash" ("_key", "data")
	SELECT k, $2::TEXT::JSONB
	FROM UNNEST($1::TEXT[]) vs(k)
	ON CONFLICT ("_key")
	DO UPDATE SET "data" = "legacy_hash"."data" || $2::TEXT::JSONB`,
					values: [key, dataString],
				});
			} else {
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
		});
	};

	module.setObjectBulk = async function (...args) {
		let data = args[0];
		if (!Array.isArray(data) || !data.length) {
			return;
		}
		if (Array.isArray(args[1])) {
			console.warn('[deprecated] db.setObjectBulk(keys, data) usage is deprecated, please use db.setObjectBulk(data)');
			// conver old format to new format for backwards compatibility
			data = args[0].map((key, i) => [key, args[1][i]]);
		}
		await module.transaction(async (client) => {
			data = data.filter((item) => {
				if (item[1].hasOwnProperty('')) {
					delete item[1][''];
				}
				return !!Object.keys(item[1]).length;
			});
			const keys = data.map(item => item[0]);
			if (!keys.length) {
				return;
			}

			await helpers.ensureLegacyObjectsType(client, keys, 'hash');
			const dataStrings = data.map(item => JSON.stringify(item[1]));
			await client.query({
				name: 'setObjectBulk',
				text: `
			INSERT INTO "legacy_hash" ("_key", "data")
			SELECT k, d
			FROM UNNEST($1::TEXT[], $2::TEXT::JSONB[]) vs(k, d)
			ON CONFLICT ("_key")
			DO UPDATE SET "data" = "legacy_hash"."data" || EXCLUDED.data`,
				values: [keys, dataStrings],
			});
		});
	};

	module.setObjectField = async function (key, field, value) {
		if (!field) {
			return;
		}

		await module.transaction(async (client) => {
			const valueString = JSON.stringify(value);
			if (Array.isArray(key)) {
				await module.setObject(key, { [field]: value });
			} else {
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
		});
	};

	module.getObject = async function (key, fields = []) {
		if (!key) {
			return null;
		}
		if (fields.length) {
			return await module.getObjectFields(key, fields);
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

	module.getObjects = async function (keys, fields = []) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		if (fields.length) {
			return await module.getObjectsFields(keys, fields);
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
		if (!Array.isArray(fields) || !fields.length) {
			return await module.getObject(key);
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

		const obj = {};
		fields.forEach((f) => {
			obj[f] = null;
		});

		return obj;
	};

	module.getObjectsFields = async function (keys, fields) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		if (!Array.isArray(fields) || !fields.length) {
			return await module.getObjects(keys);
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
		if (!key || (Array.isArray(key) && !key.length) || !Array.isArray(fields) || !fields.length) {
			return;
		}

		if (Array.isArray(key)) {
			await module.pool.query({
				name: 'deleteObjectFieldsKeys',
				text: `
	UPDATE "legacy_hash"
	   SET "data" = COALESCE((SELECT jsonb_object_agg("key", "value")
								FROM jsonb_each("data")
							   WHERE "key" <> ALL ($2::TEXT[])), '{}')
	 WHERE "_key" = ANY($1::TEXT[])`,
				values: [key, fields],
			});
		} else {
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
		}
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

		return await module.transaction(async (client) => {
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

	module.incrObjectFieldByBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}
		// TODO: perf?
		await Promise.all(data.map(async (item) => {
			for (const [field, value] of Object.entries(item[1])) {
				// eslint-disable-next-line no-await-in-loop
				await module.incrObjectFieldBy(item[0], field, value);
			}
		}));
	};
};
