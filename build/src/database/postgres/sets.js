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
const _ = require('lodash');
function default_1(module) {
    const helpers = require('./helpers').defualt;
    module.setAdd = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(value)) {
                value = [value];
            }
            if (!value.length) {
                return;
            }
            yield module.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                yield helpers.ensureLegacyObjectType(client, key, 'set');
                yield client.query({
                    name: 'setAdd',
                    text: `
INSERT INTO "legacy_set" ("_key", "member")
SELECT $1::TEXT, m
FROM UNNEST($2::TEXT[]) m
ON CONFLICT ("_key", "member")
DO NOTHING`,
                    values: [key, value],
                });
            }));
        });
    };
    module.setsAdd = function (keys, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return;
            }
            if (!Array.isArray(value)) {
                value = [value];
            }
            keys = _.uniq(keys);
            yield module.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                yield helpers.ensureLegacyObjectsType(client, keys, 'set');
                yield client.query({
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
            }));
        });
    };
    module.setRemove = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(key)) {
                key = [key];
            }
            if (!Array.isArray(value)) {
                value = [value];
            }
            yield module.pool.query({
                name: 'setRemove',
                text: `
DELETE FROM "legacy_set"
 WHERE "_key" = ANY($1::TEXT[])
   AND "member" = ANY($2::TEXT[])`,
                values: [key, value],
            });
        });
    };
    module.setsRemove = function (keys, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return;
            }
            yield module.pool.query({
                name: 'setsRemove',
                text: `
DELETE FROM "legacy_set"
 WHERE "_key" = ANY($1::TEXT[])
   AND "member" = $2::TEXT`,
                values: [keys, value],
            });
        });
    };
    module.isSetMember = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return false;
            }
            const res = yield module.pool.query({
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
        });
    };
    module.isSetMembers = function (key, values) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key || !Array.isArray(values) || !values.length) {
                return [];
            }
            values = values.map(helpers.valueToString);
            const res = yield module.pool.query({
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
            return values.map(v => res.rows.some((r) => r.m === v));
        });
    };
    module.isMemberOfSets = function (sets, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(sets) || !sets.length) {
                return [];
            }
            value = helpers.valueToString(value);
            const res = yield module.pool.query({
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
            return sets.map(s => res.rows.some((r) => r.k === s));
        });
    };
    module.getSetMembers = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return [];
            }
            const res = yield module.pool.query({
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
            return res.rows.map((r) => r.m);
        });
    };
    module.getSetsMembers = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return [];
            }
            const res = yield module.pool.query({
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
            return keys.map(k => (res.rows.find((r) => r.k === k) || { m: [] }).m);
        });
    };
    module.setCount = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return 0;
            }
            const res = yield module.pool.query({
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
        });
    };
    module.setsCount = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield module.pool.query({
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
            return keys.map(k => (res.rows.find((r) => r.k === k) || { c: 0 }).c);
        });
    };
    module.setRemoveRandom = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield module.pool.query({
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
        });
    };
}
exports.default = default_1;
;
