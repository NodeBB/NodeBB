'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
function default_1(module) {
    const helpers = require('./helpers').defualt;
    module.flushdb = function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.pool.query(`DROP SCHEMA "public" CASCADE`);
            yield module.pool.query(`CREATE SCHEMA "public"`);
        });
    };
    module.emptydb = function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.pool.query(`DELETE FROM "legacy_object"`);
        });
    };
    module.exists = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            // Redis/Mongo consider empty zsets as non-existent, match that behaviour
            const type = yield module.type(key);
            if (type === 'zset') {
                if (Array.isArray(key)) {
                    const members = yield Promise.all(key.map(key => module.getSortedSetRange(key, 0, 0)));
                    return members.map(member => member.length > 0);
                }
                const members = yield module.getSortedSetRange(key, 0, 0);
                return members.length > 0;
            }
            if (Array.isArray(key)) {
                const res = yield module.pool.query({
                    name: 'existsArray',
                    text: `
				SELECT o."_key" k
  				FROM "legacy_object_live" o
 				WHERE o."_key" = ANY($1::TEXT[])`,
                    values: [key],
                });
                return key.map(k => res.rows.some((r) => r.k === k));
            }
            const res = yield module.pool.query({
                name: 'exists',
                text: `
			SELECT EXISTS(SELECT *
					FROM "legacy_object_live"
				   WHERE "_key" = $1::TEXT
				   LIMIT 1) e`,
                values: [key],
            });
            return res.rows[0].e;
        });
    };
    module.scan = function (params) {
        return __awaiter(this, void 0, void 0, function* () {
            let { match } = params;
            if (match.startsWith('*')) {
                match = `%${match.substring(1)}`;
            }
            if (match.endsWith('*')) {
                match = `${match.substring(0, match.length - 1)}%`;
            }
            const res = yield module.pool.query({
                text: `
		SELECT o."_key"
		FROM "legacy_object_live" o
		WHERE o."_key" LIKE '${match}'`,
            });
            return res.rows.map((r) => r._key);
        });
    };
    module.delete = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            yield module.pool.query({
                name: 'delete',
                text: `
DELETE FROM "legacy_object"
 WHERE "_key" = $1::TEXT`,
                values: [key],
            });
        });
    };
    module.deleteAll = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return;
            }
            yield module.pool.query({
                name: 'deleteAll',
                text: `
DELETE FROM "legacy_object"
 WHERE "_key" = ANY($1::TEXT[])`,
                values: [keys],
            });
        });
    };
    module.get = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            const res = yield module.pool.query({
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
        });
    };
    module.set = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            yield module.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                yield helpers.ensureLegacyObjectType(client, key, 'string');
                yield client.query({
                    name: 'set',
                    text: `
INSERT INTO "legacy_string" ("_key", "data")
VALUES ($1::TEXT, $2::TEXT)
ON CONFLICT ("_key")
DO UPDATE SET "data" = $2::TEXT`,
                    values: [key, value],
                });
            }));
        });
    };
    module.increment = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            return yield module.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                yield helpers.ensureLegacyObjectType(client, key, 'string');
                const res = yield client.query({
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
            }));
        });
    };
    module.rename = function (oldKey, newKey) {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                yield client.query({
                    name: 'deleteRename',
                    text: `
	DELETE FROM "legacy_object"
	 WHERE "_key" = $1::TEXT`,
                    values: [newKey],
                });
                yield client.query({
                    name: 'rename',
                    text: `
UPDATE "legacy_object"
SET "_key" = $2::TEXT
WHERE "_key" = $1::TEXT`,
                    values: [oldKey, newKey],
                });
            }));
        });
    };
    module.type = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield module.pool.query({
                name: 'type',
                text: `
SELECT "type"::TEXT t
  FROM "legacy_object_live"
 WHERE "_key" = $1::TEXT
 LIMIT 1`,
                values: [key],
            });
            return res.rows.length ? res.rows[0].t : null;
        });
    };
    function doExpire(key, date) {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.pool.query({
                name: 'expire',
                text: `
UPDATE "legacy_object"
   SET "expireAt" = $2::TIMESTAMPTZ
 WHERE "_key" = $1::TEXT`,
                values: [key, date],
            });
        });
    }
    module.expire = function (key, seconds) {
        return __awaiter(this, void 0, void 0, function* () {
            yield doExpire(key, new Date(((Date.now() / 1000) + seconds) * 1000));
        });
    };
    module.expireAt = function (key, timestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            yield doExpire(key, new Date(timestamp * 1000));
        });
    };
    module.pexpire = function (key, ms) {
        return __awaiter(this, void 0, void 0, function* () {
            yield doExpire(key, new Date(Date.now() + parseInt(ms, 10)));
        });
    };
    module.pexpireAt = function (key, timestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            yield doExpire(key, new Date(timestamp));
        });
    };
    function getExpire(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield module.pool.query({
                name: 'ttl',
                text: `
SELECT "expireAt"::TEXT
  FROM "legacy_object"
 WHERE "_key" = $1::TEXT
 LIMIT 1`,
                values: [key],
            });
            return res.rows.length ? new Date(res.rows[0].expireAt).getTime() : null;
        });
    }
    module.ttl = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return Math.round(((yield getExpire(key)) - Date.now()) / 1000);
        });
    };
    module.pttl = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield getExpire(key)) - Date.now();
        });
    };
}
exports.default = default_1;
;
