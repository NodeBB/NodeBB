'use strict';

export default  function (module) {
	const helpers = require('./helpers').defualt;

	module.flushdb = async function () {
		await module.pool.query(`DROP SCHEMA "public" CASCADE`);
		await module.pool.query(`CREATE SCHEMA "public"`);
	};

	module.emptydb = async function () {
		await module.pool.query(`DELETE FROM "legacy_object"`);
	};

	module.exists = async function (key: string) {
		if (!key) {
			return;
		}

		// Redis/Mongo consider empty zsets as non-existent, match that behaviour
		const type = await module.type(key);
		if (type === 'zset') {
			if (Array.isArray(key)) {
				const members = await Promise.all(key.map(key => module.getSortedSetRange(key, 0, 0)));
				return members.map(member => member.length > 0);
			}
			const members = await module.getSortedSetRange(key, 0, 0);
			return members.length > 0;
		}

		if (Array.isArray(key)) {
			const res = await module.pool.query({
				name: 'existsArray',
				text: `
				SELECT o."_key" k
  				FROM "legacy_object_live" o
 				WHERE o."_key" = ANY($1::TEXT[])`,
				values: [key],
			});
			return key.map(k => res.rows.some((r) => r.k === k));
		}
		const res = await module.pool.query({
			name: 'exists',
			text: `
			SELECT EXISTS(SELECT *
					FROM "legacy_object_live"
				   WHERE "_key" = $1::TEXT
				   LIMIT 1) e`,
			values: [key],
		});
		return res.rows[0].e;
	};

	module.scan = async function (params) {
		let { match } = params;
		if (match.startsWith('*')) {
			match = `%${match.substring(1)}`;
		}
		if (match.endsWith('*')) {
			match = `${match.substring(0, match.length - 1)}%`;
		}

		const res = await module.pool.query({
			text: `
		SELECT o."_key"
		FROM "legacy_object_live" o
		WHERE o."_key" LIKE '${match}'`,
		});

		return res.rows.map((r) => r._key);
	};

	module.delete = async function (key: string) {
		if (!key) {
			return;
		}

		await module.pool.query({
			name: 'delete',
			text: `
DELETE FROM "legacy_object"
 WHERE "_key" = $1::TEXT`,
			values: [key],
		});
	};

	module.deleteAll = async function (keys: string[]) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		await module.pool.query({
			name: 'deleteAll',
			text: `
DELETE FROM "legacy_object"
 WHERE "_key" = ANY($1::TEXT[])`,
			values: [keys],
		});
	};

	module.get = async function (key: string) {
		if (!key) {
			return;
		}

		const res = await module.pool.query({
			name: 'get',
			text: `
SELECT s."data" t
  FROM "legacy_object_live" o
 INNER JOIN "legacy_string" s
         ON o."_key" = s."_key"
        AND o."type" = s."type"
 WHERE o."_key" = $1::TEXT
 LIMIT 1`,
			values: [key],
		});

		return res.rows.length ? res.rows[0].t : null;
	};

	module.set = async function (key: string, value: string) {
		if (!key) {
			return;
		}

		await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectType(client, key, 'string');
			await client.query({
				name: 'set',
				text: `
INSERT INTO "legacy_string" ("_key", "data")
VALUES ($1::TEXT, $2::TEXT)
ON CONFLICT ("_key")
DO UPDATE SET "data" = $2::TEXT`,
				values: [key, value],
			});
		});
	};

	module.increment = async function (key: string) {
		if (!key) {
			return;
		}

		return await module.transaction(async (client) => {
			await helpers.ensureLegacyObjectType(client, key, 'string');
			const res = await client.query({
				name: 'increment',
				text: `
INSERT INTO "legacy_string" ("_key", "data")
VALUES ($1::TEXT, '1')
ON CONFLICT ("_key")
DO UPDATE SET "data" = ("legacy_string"."data"::NUMERIC + 1)::TEXT
RETURNING "data" d`,
				values: [key],
			});
			return parseFloat(res.rows[0].d);
		});
	};

	module.rename = async function (oldKey: string, newKey: string) {
		await module.transaction(async (client) => {
			await client.query({
				name: 'deleteRename',
				text: `
	DELETE FROM "legacy_object"
	 WHERE "_key" = $1::TEXT`,
				values: [newKey],
			});
			await client.query({
				name: 'rename',
				text: `
UPDATE "legacy_object"
SET "_key" = $2::TEXT
WHERE "_key" = $1::TEXT`,
				values: [oldKey, newKey],
			});
		});
	};

	module.type = async function (key: string) {
		const res = await module.pool.query({
			name: 'type',
			text: `
SELECT "type"::TEXT t
  FROM "legacy_object_live"
 WHERE "_key" = $1::TEXT
 LIMIT 1`,
			values: [key],
		});

		return res.rows.length ? res.rows[0].t : null;
	};

	async function doExpire(key: string, date) {
		await module.pool.query({
			name: 'expire',
			text: `
UPDATE "legacy_object"
   SET "expireAt" = $2::TIMESTAMPTZ
 WHERE "_key" = $1::TEXT`,
			values: [key, date],
		});
	}

	module.expire = async function (key: string, seconds: number) {
		await doExpire(key, new Date(((Date.now() / 1000) + seconds) * 1000));
	};

	module.expireAt = async function (key:string, timestamp: number) {
		await doExpire(key, new Date(timestamp * 1000));
	};

	module.pexpire = async function (key: string, ms: number | string) {
		await doExpire(key, new Date(Date.now() + parseInt((ms as string), 10)));
	};

	module.pexpireAt = async function (key: string, timestamp) {
		await doExpire(key, new Date(timestamp));
	};

	async function getExpire(key: string) {
		const res = await module.pool.query({
			name: 'ttl',
			text: `
SELECT "expireAt"::TEXT
  FROM "legacy_object"
 WHERE "_key" = $1::TEXT
 LIMIT 1`,
			values: [key],
		});

		return res.rows.length ? new Date(res.rows[0].expireAt).getTime() : null;
	}

	module.ttl = async function (key: string) {
		return Math.round((await getExpire(key) as number - Date.now()) / 1000);
	};

	module.pttl = async function (key: string) {
		return await getExpire(key) as number - Date.now();
	};
};
