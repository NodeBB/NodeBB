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
    module.listPrepend = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            yield module.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                yield helpers.ensureLegacyObjectType(client, key, 'list');
                value = Array.isArray(value) ? value : [value];
                value.reverse();
                yield client.query({
                    name: 'listPrependValues',
                    text: `
INSERT INTO "legacy_list" ("_key", "array")
VALUES ($1::TEXT, $2::TEXT[])
ON CONFLICT ("_key")
DO UPDATE SET "array" = EXCLUDED.array || "legacy_list"."array"`,
                    values: [key, value],
                });
            }));
        });
    };
    module.listAppend = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            yield module.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                value = Array.isArray(value) ? value : [value];
                yield helpers.ensureLegacyObjectType(client, key, 'list');
                yield client.query({
                    name: 'listAppend',
                    text: `
INSERT INTO "legacy_list" ("_key", "array")
VALUES ($1::TEXT, $2::TEXT[])
ON CONFLICT ("_key")
DO UPDATE SET "array" = "legacy_list"."array" || EXCLUDED.array`,
                    values: [key, value],
                });
            }));
        });
    };
    module.listRemoveLast = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            const res = yield module.pool.query({
                name: 'listRemoveLast',
                text: `
WITH A AS (
	SELECT l.*
	  FROM "legacy_object_live" o
	 INNER JOIN "legacy_list" l
	         ON o."_key" = l."_key"
	        AND o."type" = l."type"
	 WHERE o."_key" = $1::TEXT
	   FOR UPDATE)
UPDATE "legacy_list" l
   SET "array" = A."array"[1 : array_length(A."array", 1) - 1]
  FROM A
 WHERE A."_key" = l."_key"
RETURNING A."array"[array_length(A."array", 1)] v`,
                values: [key],
            });
            return res.rows.length ? res.rows[0].v : null;
        });
    };
    module.listRemoveAll = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            // TODO: remove all values with one query
            if (Array.isArray(value)) {
                yield Promise.all(value.map(v => module.listRemoveAll(key, v)));
                return;
            }
            yield module.pool.query({
                name: 'listRemoveAll',
                text: `
UPDATE "legacy_list" l
   SET "array" = array_remove(l."array", $2::TEXT)
  FROM "legacy_object_live" o
 WHERE o."_key" = l."_key"
   AND o."type" = l."type"
   AND o."_key" = $1::TEXT`,
                values: [key, value],
            });
        });
    };
    module.listTrim = function (key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            stop += 1;
            yield module.pool.query(stop > 0 ? {
                name: 'listTrim',
                text: `
UPDATE "legacy_list" l
   SET "array" = ARRAY(SELECT m.m
                         FROM UNNEST(l."array") WITH ORDINALITY m(m, i)
                        ORDER BY m.i ASC
                        LIMIT ($3::INTEGER - $2::INTEGER)
                       OFFSET $2::INTEGER)
  FROM "legacy_object_live" o
 WHERE o."_key" = l."_key"
   AND o."type" = l."type"
   AND o."_key" = $1::TEXT`,
                values: [key, start, stop],
            } : {
                name: 'listTrimBack',
                text: `
UPDATE "legacy_list" l
   SET "array" = ARRAY(SELECT m.m
                         FROM UNNEST(l."array") WITH ORDINALITY m(m, i)
                        ORDER BY m.i ASC
                        LIMIT ($3::INTEGER - $2::INTEGER + array_length(l."array", 1))
                       OFFSET $2::INTEGER)
  FROM "legacy_object_live" o
 WHERE o."_key" = l."_key"
   AND o."type" = l."type"
   AND o."_key" = $1::TEXT`,
                values: [key, start, stop],
            });
        });
    };
    module.getListRange = function (key, start, stop) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            stop += 1;
            const res = yield module.pool.query(stop > 0 ? {
                name: 'getListRange',
                text: `
SELECT ARRAY(SELECT m.m
               FROM UNNEST(l."array") WITH ORDINALITY m(m, i)
              ORDER BY m.i ASC
              LIMIT ($3::INTEGER - $2::INTEGER)
             OFFSET $2::INTEGER) l
  FROM "legacy_object_live" o
 INNER JOIN "legacy_list" l
         ON o."_key" = l."_key"
        AND o."type" = l."type"
      WHERE o."_key" = $1::TEXT`,
                values: [key, start, stop],
            } : {
                name: 'getListRangeBack',
                text: `
SELECT ARRAY(SELECT m.m
               FROM UNNEST(l."array") WITH ORDINALITY m(m, i)
              ORDER BY m.i ASC
              LIMIT ($3::INTEGER - $2::INTEGER + array_length(l."array", 1))
             OFFSET $2::INTEGER) l
  FROM "legacy_object_live" o
 INNER JOIN "legacy_list" l
         ON o."_key" = l."_key"
        AND o."type" = l."type"
 WHERE o."_key" = $1::TEXT`,
                values: [key, start, stop],
            });
            return res.rows.length ? res.rows[0].l : [];
        });
    };
    module.listLength = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield module.pool.query({
                name: 'listLength',
                text: `
SELECT array_length(l."array", 1) l
  FROM "legacy_object_live" o
 INNER JOIN "legacy_list" l
         ON o."_key" = l."_key"
        AND o."type" = l."type"
      WHERE o."_key" = $1::TEXT`,
                values: [key],
            });
            return res.rows.length ? res.rows[0].l : 0;
        });
    };
}
exports.default = default_1;
;
