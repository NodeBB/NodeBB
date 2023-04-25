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
		module.transaction((db) => {
			const dataString = JSON.stringify(data);

			let keys;
			if (Array.isArray(key)) {
				helpers.ensureLegacyObjectsType(db, key, 'hash');
				keys = key;
			} else {
				helpers.ensureLegacyObjectType(db, key, 'hash');
				keys = [ key ];
			}
			const insert = db.prepare(`
			INSERT INTO "legacy_hash" ("_key", "data")
			VALUES (@key, @data)
			ON CONFLICT ("_key")
			DO UPDATE SET "data" = json_merge("legacy_hash"."data", @data)`);
			for (const key of keys) {
				insert.run({ key, data: dataString });
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
			data = args[0].map((key, i) => [ key, args[1][i] ]);
		}
		module.transaction((db) => {
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

			helpers.ensureLegacyObjectsType(db, keys, 'hash');
			const upsert = db.prepare(`
			INSERT INTO "legacy_hash" ("_key", "data")
			VALUES (@key, @data)
			ON CONFLICT ("_key")
			DO UPDATE SET "data" = json_merge("legacy_hash"."data", @data)`);
			for (const [i, key] of keys.entries()) {
				const dataString = JSON.stringify(data[i][1]);
				upsert.run({ key, data:dataString });
			}
		});
	};

	module.setObjectField = async function (key, field, value) {
		if (!field) {
			return;
		}

		if (Array.isArray(key)) {
			module.setObject(key, { [field]: value });
		} else {
			module.transaction((db) => {
				helpers.ensureLegacyObjectType(db, key, 'hash');
				const valueString = JSON.stringify(value);
				const params = { key, field, value: valueString };
				db.prepare(`
				INSERT INTO "legacy_hash" ("_key", "data")
				VALUES (@key, json_set(NULL, @field, @value))
				ON CONFLICT ("_key")
				DO UPDATE SET "data" = json_set("legacy_hash"."data", @field, @value)`).run(params);
			});	
		}
	};

	module.getObject = async function (key, fields = []) {
		if (!key) {
			return null;
		}
		if (fields.length) {
			return await module.getObjectFields(key, fields);
		}
		const res = module.db.prepare(`
		SELECT h."data"
		FROM "legacy_object_live" o
		INNER JOIN "legacy_hash" h
			 ON o."_key" = h."_key"
			AND o."type" = h."type"
		WHERE o."_key" = @key
		LIMIT 1`).get({ key });

		return res ? JSON.parse(res.data) : null;
	};

	module.getObjects = async function (keys, fields = []) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}
		if (fields.length) {
			return module.getObjectsFields(keys, fields);
		}
		const [ params, keyList ] = helpers.listParams({}, keys);
		const rows = module.db.prepare(`
		SELECT h."_key", h."data"
		FROM "legacy_object_live" o
		INNER JOIN "legacy_hash" h
			 ON o."_key" = h."_key"
			AND o."type" = h."type"
		WHERE o."_key" IN (${keyList})`).all(params);

		return keys.map((key) => {
			const row = rows.find(r => r._key === key);
			return row ? JSON.parse(row.data) : null;
		});
	};

	module.getObjectField = async function (key, field) {
		if (!key) {
			return null;
		}

		if (Array.isArray(field)) {
			return null;
		}

		const params = { key, field };
		const res = module.db.prepare(`
		SELECT json_get(h."data", @field) AS f
		FROM "legacy_object_live" o
		INNER JOIN "legacy_hash" h
			 ON o."_key" = h."_key"
			AND o."type" = h."type"
		WHERE o."_key" = @key
		LIMIT 1`).get(params);

		return res ? JSON.parse(res.f) : null;
	};

	module.getObjectFields = async function (key, fields) {
		if (!key) {
			return null;
		}
		if (!Array.isArray(fields) || !fields.length) {
			return await module.getObject(key);
		}

		const [ params, fieldList ] = helpers.listParams({ key }, fields);
		const res = module.db.prepare(`
		SELECT json_gather(h."data", ${fieldList}) AS d
		FROM "legacy_object_live" o
		INNER JOIN "legacy_hash" h
			 ON o."_key" = h."_key"
			AND o."type" = h."type"
		WHERE o."_key" = @key
		LIMIT 1`).get(params);

		if (res) {
			return JSON.parse(res.d);
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
		const [ params, keyList ] = helpers.listParams({}, keys);
		const [ , fieldList ] = helpers.listParams(params, fields, 'name');
		const rows = module.db.prepare(`
			SELECT h."_key" k, json_gather(h."data", ${fieldList}) as d
				FROM "legacy_object_live" o
					INNER JOIN "legacy_hash" h
									ON o."_key" = h."_key"
 								 AND o."type" = h."type"
			WHERE o."_key" IN (${keyList})`).all(params);

		return keys.map((key) => {
			const row = rows.find(r => r.k === key);
			return row ? JSON.parse(row.d) : {};
		});
	};

	module.getObjectKeys = async function (key) {
		if (!key) {
			return;
		}

		const params = { key };
		const res = module.db.prepare(`
		SELECT json_keys(h."data") k
		FROM "legacy_object_live" o
		INNER JOIN "legacy_hash" h
			 ON o."_key" = h."_key"
			AND o."type" = h."type"
		WHERE o."_key" = @key
		LIMIT 1`).get(params);

		return res ? JSON.parse(res.k) : [];
	};

	module.getObjectValues = async function (key) {
		const data = await module.getObject(key);
		return data ? Object.values(data) : [];
	};

	module.isObjectField = async function (key, field) {
		if (!key) {
			return;
		}

		const params = { key };
		const res = module.db.prepare(`
		SELECT h."data"
  	FROM "legacy_object_live" o
 		INNER JOIN "legacy_hash" h
       ON o."_key" = h."_key"
      AND o."type" = h."type"
 		WHERE o."_key" = @key
 		LIMIT 1`).get(params);

		if (res) {
			const fields = JSON.parse(res.data);
			return fields[field] != null;
		} else {
			return false;
		}
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

		module.transaction((db) => {
			const [ params, keyList ] = helpers.listParams({}, key);
			const rows = db.prepare(`
			SELECT "_key", 
			       "data"
			FROM "legacy_hash"
			WHERE "_key" IN (${keyList})`).all(params);
			let update;
			for (const row of rows) {
				const cleared = JSON.parse(row.data);
				if (cleared && fields.some(f => cleared.hasOwnProperty(f))) {
					for (const f of fields) {
						delete cleared[f];
					}
					const dataString = JSON.stringify(cleared);
					if (!update) {
						update = module.db.prepare(`
						UPDATE "legacy_hash"
								SET "data" = @data
							WHERE "_key" = @key`);				
					}
					update.run({ key:row._key, data: dataString });
				}
			}	
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

		return module.transaction((db) => {
			let keys;
			if (Array.isArray(key)) {
				helpers.ensureLegacyObjectsType(db, key, 'hash');
				keys = key;
			} else {
				helpers.ensureLegacyObjectType(db, key, 'hash');
				keys = [key];
			}

			const upsert = db.prepare(`
			INSERT INTO "legacy_hash" ("_key", "data")
			VALUES (@key, json_inc(NULL, @field, @value))
			ON CONFLICT ("_key")
			DO UPDATE SET "data" = json_inc("legacy_hash"."data", @field, @value)`);
			for (const key of keys) {
				upsert.run({ key, field, value });
			}
			const [ params, keyList ] = helpers.listParams({ field }, keys);
			const rows = db.prepare(`
			SELECT h."_key", 
			       json_get(h."data", @field) AS v
			FROM "legacy_hash" h
			WHERE h."_key" IN (${keyList})`).all(params);
			const values = keys.map((key) => {
				const row = rows.find(r => r._key === key);
				return row ? JSON.parse(row.v) : null;
			});

			return Array.isArray(key) ? values : values[0];
		});
	};

	module.incrObjectFieldByBulk = async function (data) {
		if (!Array.isArray(data) || !data.length) {
			return;
		}
		// TODO: perf?
		await Promise.all(data.map(async (item) => {
			for (const [ field, value ] of Object.entries(item[1])) {
				// eslint-disable-next-line no-await-in-loop
				await module.incrObjectFieldBy(item[0], field, value);
			}
		}));
	};
};
