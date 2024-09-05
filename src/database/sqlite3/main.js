'use strict';

module.exports = function (module) {
	const helpers = require('./helpers');

	module.flushdb = async function () {
		module.db.exec(`
		PRAGMA writable_schema = 1;
		delete from sqlite_master where type in ('table', 'index', 'trigger');
		PRAGMA writable_schema = 0;
		VACUUM;		
		`);
	};

	module.emptydb = async function () {
		module.db.exec(`DELETE FROM "legacy_object"`);
	};

	module.exists = async function (key) {
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
			const [ params, keyList ] = helpers.listParams({}, key);
			const rows = module.db.prepare(`
			SELECT o."_key" k
			FROM "legacy_object_live" o
			WHERE o."_key" IN (${keyList})`).all(params);
			return key.map(k => rows.some(r => r.k === k));
		} else {
			const params = { key };
			const res = module.db.prepare(`
				SELECT EXISTS(
					SELECT *
					FROM "legacy_object_live"
					WHERE "_key" = @key
					LIMIT 1) e`).get(params);
			return !!res.e;	
		}
	};

	module.scan = async function (params) {
		let { match } = params;
		if (match.startsWith('*')) {
			match = `%${match.substring(1)}`;
		}
		if (match.endsWith('*')) {
			match = `${match.substring(0, match.length - 1)}%`;
		}

		const rows = module.db.prepare(`
		SELECT o."_key"
		FROM "legacy_object_live" o
		WHERE o."_key" LIKE '${match}'`).all();

		return rows.map(r => r._key);
	};

	module.delete = async function (key) {
		if (!key) {
			return;
		}

		const params = { key };
		module.db.prepare(`
		DELETE FROM "legacy_object"
		WHERE "_key" = @key`).run(params);
	};

	module.deleteAll = async function (keys) {
		if (!Array.isArray(keys) || !keys.length) {
			return;
		}

		const [ params, keyList ] = helpers.listParams({}, keys);
		module.db.prepare(`
		DELETE FROM "legacy_object"
		WHERE "_key" IN (${keyList})`).run(params);
	};

	module.get = async function (key) {
		if (!key) {
			return;
		}

		const params = { key };
		const res = module.db.prepare(`
		SELECT s."data" t
		FROM "legacy_object_live" o
		INNER JOIN "legacy_string" s
			 ON o."_key" = s."_key"
			AND o."type" = s."type"
		WHERE o."_key" = @key
		LIMIT 1`).get(params);

		return res ? res.t : null;
	};

	module.set = async function (key, value) {
		if (!key) {
			return;
		}

		module.transaction((db) => {
			helpers.ensureLegacyObjectType(db, key, 'string');
			const params = { key, value };
			db.prepare(`
			INSERT INTO "legacy_string" ("_key", "data")
			VALUES (@key, @value)
			ON CONFLICT ("_key")
			DO UPDATE SET "data" = @value`).run(params);
		});
	};

	module.increment = async function (key) {
		if (!key) {
			return;
		}

		return module.transaction((db) => {
			helpers.ensureLegacyObjectType(db, key, 'string');
			const params = { key };
			db.prepare(`
			INSERT INTO "legacy_string" ("_key", "data")
			VALUES (@key, '1')
			ON CONFLICT ("_key")
			DO UPDATE SET "data" = "legacy_string"."data" + 1`).run(params);
			const res = db.prepare(`
			SELECT "data" d
			FROM "legacy_string"
			WHERE "_key" = @key`).get(params);
			return parseFloat(res.d);
		});
	};

	module.rename = async function (oldKey, newKey) {
		module.transaction((db) => {
			const params = { oldKey, newKey };
			db.prepare(`
			DELETE FROM "legacy_object"
			WHERE "_key" = @newKey`).run(params);
			db.prepare(`
			UPDATE "legacy_object"
			SET "_key" = @newKey
			WHERE "_key" = @oldKey`).run(params);
		});
	};

	module.type = async function (key) {
		if (Array.isArray(key)) {
			if (key.length === 0) {
				return null;
			}
			key = key[0];
		}
		const params = { key };
		const res = module.db.prepare(`
		SELECT "type" t
		FROM "legacy_object_live"
		WHERE "_key" = @key
		LIMIT 1`).get(params);

		return res ? res.t : null;
	};

	async function doExpire(key, date) {
		const expireAt = date.toISOString().replace('T', ' ');
		const params = { key, expireAt };
		module.db.prepare(`
		UPDATE "legacy_object"
		SET "expireAt" = @expireAt
		WHERE "_key" = @key`).run(params);
	}

	module.expire = async function (key, seconds) {
		await doExpire(key, new Date(((Date.now() / 1000) + seconds) * 1000));
	};

	module.expireAt = async function (key, timestamp) {
		await doExpire(key, new Date(timestamp * 1000));
	};

	module.pexpire = async function (key, ms) {
		await doExpire(key, new Date(Date.now() + parseInt(ms, 10)));
	};

	module.pexpireAt = async function (key, timestamp) {
		await doExpire(key, new Date(timestamp));
	};

	async function getExpire(key) {
		const params = { key };
		const res = module.db.prepare(`
		SELECT "expireAt"
		FROM "legacy_object"
		WHERE "_key" = @key
		LIMIT 1`).get(params);

		return res && res.expireAt ? new Date(res.expireAt).getTime() : null;
	}

	module.ttl = async function (key) {
		return Math.round((await getExpire(key) - Date.now()) / 1000);
	};

	module.pttl = async function (key) {
		return await getExpire(key) - Date.now();
	};
};
