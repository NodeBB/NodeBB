'use strict';

const _ = require('lodash');

module.exports = function (module) {
	const helpers = require('./helpers');

	module.setAdd = async function (key, value) {
		if (!Array.isArray(value)) {
			value = [value];
		}
		if (!value.length) {
			return;
		}
		await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectType(client, key, 'set');
			await client.query({
				name: 'setAdd',
				text: `
INSERT INTO "legacy_set" ("_key", "member")
SELECT $1::TEXT, m
FROM UNNEST($2::TEXT[]) m
ON CONFLICT ("_key", "member")
DO NOTHING`,
				values: [key, value],
			});
		});
	};

	module.setsAdd = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		if (!Array.isArray(value)) {
			value = [value];
		}

		keys = _.uniq(keys);

		await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectsType(client, keys, 'set');
			await client.query({
				name: 'setsAdd',
				text: `
INSERT INTO "legacy_set" ("_key", "member")
SELECT k, m
FROM UNNEST($1::TEXT[]) k
CROSS JOIN UNNEST($2::TEXT[]) m
ON CONFLICT ("_key", "member")
DO NOTHING`,
				values: [keys, value],
			});
		});
	};

	module.setRemove = async function (key, value) {
		if (!Array.isArray(key)) {
			key = [key];
		}

		if (!Array.isArray(value)) {
			value = [value];
		}

		await module.pool.query({
			name: 'setRemove',
			text: `
DELETE FROM "legacy_set"
 WHERE "_key" = ANY($1::TEXT[])
   AND "member" = ANY($2::TEXT[])`,
			values: [key, value],
		});
	};

	module.setsRemove = async function (keys, value) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		await module.pool.query({
			name: 'setsRemove',
			text: `
DELETE FROM "legacy_set"
 WHERE "_key" = ANY($1::TEXT[])
   AND "member" = $2::TEXT`,
			values: [keys, value],
		});
	};

	module.isSetMember = async function (key, value) {
		if (!key) {
			return false;
		}

		const res = await module.pool.query({
			name: 'isSetMember',
			text: `
SELECT 1
  FROM "legacy_object_live" o
 INNER JOIN "legacy_set" s
    ON o."_key" = s."_key"
   AND o."type" = s."type"
 WHERE o."_key" = $1::TEXT
   AND s."member" = $2::TEXT`,
			values: [key, value],
		});

		return !!res.rows.length;
	};

	module.isSetMembers = async function (key, values) {
		if (!key || !Array.isArray(values) || !values.length) {
			return [];
		}

		values = values.map(helpers.valueToString);

		const res = await module.pool.query({
			name: 'isSetMembers',
			text: `
SELECT s."member" m
  FROM "legacy_object_live" o
 INNER JOIN "legacy_set" s
         ON o."_key" = s."_key"
        AND o."type" = s."type"
 WHERE o."_key" = $1::TEXT
   AND s."member" = ANY($2::TEXT[])`,
			values: [key, values],
		});

		return values.map(v => res.rows.some(r => r.m === v));
	};

	module.isMemberOfSets = async function (sets, value) {
		if (!Array.isArray(sets) || !sets.length) {
			return [];
		}

		value = helpers.valueToString(value);

		const res = await module.pool.query({
			name: 'isMemberOfSets',
			text: `
SELECT o."_key" k
  FROM "legacy_object_live" o
 INNER JOIN "legacy_set" s
         ON o."_key" = s."_key"
        AND o."type" = s."type"
 WHERE o."_key" = ANY($1::TEXT[])
   AND s."member" = $2::TEXT`,
			values: [sets, value],
		});

		return sets.map(s => res.rows.some(r => r.k === s));
	};

	module.getSetMembers = async function (key) {
		if (!key) {
			return [];
		}

		const res = await module.pool.query({
			name: 'getSetMembers',
			text: `
SELECT s."member" m
  FROM "legacy_object_live" o
 INNER JOIN "legacy_set" s
         ON o."_key" = s."_key"
        AND o."type" = s."type"
 WHERE o."_key" = $1::TEXT`,
			values: [key],
		});

		return res.rows.map(r => r.m);
	};

	module.getSetsMembers = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return [];
		}

		const res = await module.pool.query({
			name: 'getSetsMembers',
			text: `
SELECT o."_key" k,
       array_agg(s."member") m
  FROM "legacy_object_live" o
 INNER JOIN "legacy_set" s
         ON o."_key" = s."_key"
        AND o."type" = s."type"
 WHERE o."_key" = ANY($1::TEXT[])
 GROUP BY o."_key"`,
			values: [keys],
		});

		return keys.map(k => (res.rows.find(r => r.k === k) || { m: [] }).m);
	};

	module.setCount = async function (key) {
		if (!key) {
			return 0;
		}

		const res = await module.pool.query({
			name: 'setCount',
			text: `
SELECT COUNT(*) c
  FROM "legacy_object_live" o
 INNER JOIN "legacy_set" s
         ON o."_key" = s."_key"
        AND o."type" = s."type"
 WHERE o."_key" = $1::TEXT`,
			values: [key],
		});

		return parseInt(res.rows[0].c, 10);
	};

	module.setsCount = async function (keys) {
		const res = await module.pool.query({
			name: 'setsCount',
			text: `
SELECT o."_key" k,
       COUNT(*) c
  FROM "legacy_object_live" o
 INNER JOIN "legacy_set" s
         ON o."_key" = s."_key"
        AND o."type" = s."type"
 WHERE o."_key" = ANY($1::TEXT[])
 GROUP BY o."_key"`,
			values: [keys],
		});

		return keys.map(k => (res.rows.find(r => r.k === k) || { c: 0 }).c);
	};

	module.setRemoveRandom = async function (key) {
		const res = await module.pool.query({
			name: 'setRemoveRandom',
			text: `
WITH A AS (
	SELECT s."member"
	  FROM "legacy_object_live" o
	 INNER JOIN "legacy_set" s
	         ON o."_key" = s."_key"
	        AND o."type" = s."type"
	 WHERE o."_key" = $1::TEXT
	 ORDER BY RANDOM()
	 LIMIT 1
	   FOR UPDATE)
DELETE FROM "legacy_set" s
 USING A
 WHERE s."_key" = $1::TEXT
   AND s."member" = A."member"
RETURNING A."member" m`,
			values: [key],
		});
		return res.rows.length ? res.rows[0].m : null;
	};
};
