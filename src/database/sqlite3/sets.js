'use strict';

const _ = require('lodash');

module.exports = function (module) {
	const helpers = require('./helpers');

	module.setAdd = async function (key, values) {
		values = helpers.valuesToStrings(values);
		if (!values.length) {
			return;
		}
		module.transaction((db) => {
			helpers.ensureLegacyObjectType(db, key, 'set');
			const upsert = db.prepare(`
			INSERT INTO "legacy_set" ("_key", "member")
			VALUES (@key, @value)
			ON CONFLICT ("_key", "member")
			DO NOTHING`);
			for (const value of values) {
				upsert.run({ key, value });
			}
		});
	};

	module.setsAdd = async function (keys, values) {
		values = helpers.valuesToStrings(values);
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		keys = _.uniq(keys);

		module.transaction((db) => {
			helpers.ensureLegacyObjectsType(db, keys, 'set');
			const upsert = db.prepare(`
			INSERT INTO "legacy_set" ("_key", "member")
			VALUES (@key, @value)
			ON CONFLICT ("_key", "member")
			DO NOTHING`);
			for (const key of keys) {
				for (const value of values) {
					upsert.run({ key, value });
				}	
			}
		});
	};

	module.setRemove = async function (key, values) {
		values = helpers.valuesToStrings(values);
		const [params, keyList] = helpers.listParams({}, key);
		const [, memberList] = helpers.listParams(params, values, 'member');
		module.db.prepare(`
		DELETE FROM "legacy_set"
		WHERE "_key" IN (${keyList})
			AND "member" IN (${memberList})`).run(params);
	};

	module.setsRemove = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}
		value = helpers.valueToString(value);
		const [ params, keyList ] = helpers.listParams({ value }, keys);
		module.db.prepare(`
		DELETE FROM "legacy_set"
		WHERE "_key" IN (${keyList})
			AND "member" = @value`).run(params);
	};

	module.isSetMember = async function (key, value) {
		if (!key) {
			return false;
		}
		value = helpers.valueToString(value);
		const params = { key, value };
		const res = module.db.prepare(`
		SELECT 1
		FROM "legacy_object_live" o
		INNER JOIN "legacy_set" s
			 ON o."_key" = s."_key"
			AND o."type" = s."type"
		WHERE o."_key" = @key
			AND s."member" = @value`).get(params);

		return !!res;
	};

	module.isSetMembers = async function (key, values) {
		if (!key || !Array.isArray(values) || !values.length) {
			return [];
		}

		values = helpers.valuesToStrings(values);

		const [ params, valueList ] = helpers.listParams({ key }, values);
		const rows = module.db.prepare(`
		SELECT s."member" m
		FROM "legacy_object_live" o
		INNER JOIN "legacy_set" s
		 	 ON o."_key" = s."_key"
			AND o."type" = s."type"
		WHERE o."_key" = @key
			AND s."member" IN (${valueList})`).all(params);

		return values.map(v => rows.some(r => r.m === v));
	};

	module.isMemberOfSets = async function (sets, value) {
		if (!Array.isArray(sets) || !sets.length) {
			return [];
		}

		value = helpers.valueToString(value);

		const [ params, keyList ] = helpers.listParams({ value }, sets);
		const rows = module.db.prepare(`
		SELECT o."_key" k
		FROM "legacy_object_live" o
		INNER JOIN "legacy_set" s
			 ON o."_key" = s."_key"
			AND o."type" = s."type"
		WHERE o."_key" IN (${keyList})
			AND s."member" = @value`).all(params);

		return sets.map(s => rows.some(r => r.k === s));
	};

	module.getSetMembers = async function (key) {
		if (!key) {
			return [];
		}

		const params = { key };
		const rows = module.db.prepare(`
		SELECT s."member" m
		FROM "legacy_object_live" o
		INNER JOIN "legacy_set" s
		 	 ON o."_key" = s."_key"
			AND o."type" = s."type"
		WHERE o."_key" = @key`).all(params);

		return rows.map(r => r.m);
	};

	module.getSetsMembers = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const [ params, keyList ] = helpers.listParams({}, keys);
		const rows = module.db.prepare(`
		SELECT o."_key" k, s."member" m
		FROM "legacy_object_live" o
		INNER JOIN "legacy_set" s
			 ON o."_key" = s."_key"
			AND o."type" = s."type"
		WHERE o."_key" IN (${keyList})`).all(params);

		return keys.map(k => rows.filter(r => r.k === k).map(r => r.m));
	};

	module.setCount = async function (key) {
		if (!key) {
			return 0;
		}

		const params = { key };
		const res = module.db.prepare(`
		SELECT COUNT(*) c
  	FROM "legacy_object_live" o
 		INNER JOIN "legacy_set" s
       ON o."_key" = s."_key"
      AND o."type" = s."type"
 		WHERE o."_key" = @key`).get(params);

		return res.c;
	};

	module.setsCount = async function (keys) {
		const [ params, keyList ] = helpers.listParams({}, keys);
		const rows = module.db.prepare(`
		SELECT o."_key" k,
       		 COUNT(*) c
  	FROM "legacy_object_live" o
 		INNER JOIN "legacy_set" s
       ON o."_key" = s."_key"
      AND o."type" = s."type"
 		WHERE o."_key" IN (${keyList})
 		GROUP BY o."_key"`).all(params);

		return keys.map(k => (rows.find(r => r.k === k) || { c: 0 }).c);
	};

	module.setRemoveRandom = async function (key) {
		const params = { key };
		const res = module.db.prepare(`
		SELECT s."member" v
		FROM "legacy_object_live" o
		INNER JOIN "legacy_set" s
			 ON o."_key" = s."_key"
			AND o."type" = s."type"
		WHERE o."_key" = @key
		ORDER BY RANDOM()
		LIMIT 1`).get(params);
		let value = null;
		if (res) {
			value = params.value = res.v;
			module.db.prepare(`
			DELETE FROM "legacy_set"
				WHERE "_key" = @key
					AND "member" = @value			
			`).run(params);
		}
		return value;
	};
};
