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
    module.setObject = function (key, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key || !data) {
                return;
            }
            if (data.hasOwnProperty('')) {
                delete data[''];
            }
            if (!Object.keys(data).length) {
                return;
            }
            yield module.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                const dataString = JSON.stringify(data);
                if (Array.isArray(key)) {
                    yield helpers.ensureLegacyObjectsType(client, key, 'hash');
                    yield client.query({
                        name: 'setObjectKeys',
                        text: `
	INSERT INTO "legacy_hash" ("_key", "data")
	SELECT k, $2::TEXT::JSONB
	FROM UNNEST($1::TEXT[]) vs(k)
	ON CONFLICT ("_key")
	DO UPDATE SET "data" = "legacy_hash"."data" || $2::TEXT::JSONB`,
                        values: [key, dataString],
                    });
                }
                else {
                    yield helpers.ensureLegacyObjectType(client, key, 'hash');
                    yield client.query({
                        name: 'setObject',
                        text: `
	INSERT INTO "legacy_hash" ("_key", "data")
	VALUES ($1::TEXT, $2::TEXT::JSONB)
	ON CONFLICT ("_key")
	DO UPDATE SET "data" = "legacy_hash"."data" || $2::TEXT::JSONB`,
                        values: [key, dataString],
                    });
                }
            }));
        });
    };
    module.setObjectBulk = function (...args) {
        return __awaiter(this, void 0, void 0, function* () {
            let data = args[0];
            if (!Array.isArray(data) || !data.length) {
                return;
            }
            if (Array.isArray(args[1])) {
                console.warn('[deprecated] db.setObjectBulk(keys, data) usage is deprecated, please use db.setObjectBulk(data)');
                // conver old format to new format for backwards compatibility
                data = args[0].map((key, i) => [key, args[1][i]]);
            }
            yield module.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                data = data.filter((item) => {
                    if (item[1].hasOwnProperty('')) {
                        delete item[1][''];
                    }
                    return !!Object.keys(item[1]).length;
                });
                const keys = data.map((item) => item[0]);
                if (!keys.length) {
                    return;
                }
                yield helpers.ensureLegacyObjectsType(client, keys, 'hash');
                const dataStrings = data.map((item) => JSON.stringify(item[1]));
                yield client.query({
                    name: 'setObjectBulk',
                    text: `
			INSERT INTO "legacy_hash" ("_key", "data")
			SELECT k, d
			FROM UNNEST($1::TEXT[], $2::TEXT::JSONB[]) vs(k, d)
			ON CONFLICT ("_key")
			DO UPDATE SET "data" = "legacy_hash"."data" || EXCLUDED.data`,
                    values: [keys, dataStrings],
                });
            }));
        });
    };
    module.setObjectField = function (key, field, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!field) {
                return;
            }
            yield module.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                const valueString = JSON.stringify(value);
                if (Array.isArray(key)) {
                    yield module.setObject(key, { [field]: value });
                }
                else {
                    yield helpers.ensureLegacyObjectType(client, key, 'hash');
                    yield client.query({
                        name: 'setObjectField',
                        text: `
	INSERT INTO "legacy_hash" ("_key", "data")
	VALUES ($1::TEXT, jsonb_build_object($2::TEXT, $3::TEXT::JSONB))
	ON CONFLICT ("_key")
	DO UPDATE SET "data" = jsonb_set("legacy_hash"."data", ARRAY[$2::TEXT], $3::TEXT::JSONB)`,
                        values: [key, field, valueString],
                    });
                }
            }));
        });
    };
    module.getObject = function (key, fields = []) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return null;
            }
            if (fields.length) {
                return yield module.getObjectFields(key, fields);
            }
            const res = yield module.pool.query({
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
        });
    };
    module.getObjects = function (keys, fields = []) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return [];
            }
            if (fields.length) {
                return yield module.getObjectsFields(keys, fields);
            }
            const res = yield module.pool.query({
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
            return res.rows.map((row) => row.data);
        });
    };
    module.getObjectField = function (key, field) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return null;
            }
            const res = yield module.pool.query({
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
        });
    };
    module.getObjectFields = function (key, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return null;
            }
            if (!Array.isArray(fields) || !fields.length) {
                return yield module.getObject(key);
            }
            const res = yield module.pool.query({
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
        });
    };
    module.getObjectsFields = function (keys, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return [];
            }
            if (!Array.isArray(fields) || !fields.length) {
                return yield module.getObjects(keys);
            }
            const res = yield module.pool.query({
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
            return res.rows.map((row) => row.d);
        });
    };
    module.getObjectKeys = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            const res = yield module.pool.query({
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
        });
    };
    module.getObjectValues = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield module.getObject(key);
            return data ? Object.values(data) : [];
        });
    };
    module.isObjectField = function (key, field) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            const res = yield module.pool.query({
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
        });
    };
    module.isObjectFields = function (key, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            const data = yield module.getObjectFields(key, fields);
            if (!data) {
                return fields.map(() => false);
            }
            return fields.map((field) => data.hasOwnProperty(field) && data[field] !== null);
        });
    };
    module.deleteObjectField = function (key, field) {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.deleteObjectFields(key, [field]);
        });
    };
    module.deleteObjectFields = function (key, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key || (Array.isArray(key) && !key.length) || !Array.isArray(fields) || !fields.length) {
                return;
            }
            if (Array.isArray(key)) {
                yield module.pool.query({
                    name: 'deleteObjectFieldsKeys',
                    text: `
	UPDATE "legacy_hash"
	   SET "data" = COALESCE((SELECT jsonb_object_agg("key", "value")
								FROM jsonb_each("data")
							   WHERE "key" <> ALL ($2::TEXT[])), '{}')
	 WHERE "_key" = ANY($1::TEXT[])`,
                    values: [key, fields],
                });
            }
            else {
                yield module.pool.query({
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
        });
    };
    module.incrObjectField = function (key, field) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.incrObjectFieldBy(key, field, 1);
        });
    };
    module.decrObjectField = function (key, field) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.incrObjectFieldBy(key, field, -1);
        });
    };
    module.incrObjectFieldBy = function (key, field, value) {
        return __awaiter(this, void 0, void 0, function* () {
            value = parseInt(value, 10);
            if (!key || isNaN(value)) {
                return null;
            }
            return yield module.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                if (Array.isArray(key)) {
                    yield helpers.ensureLegacyObjectsType(client, key, 'hash');
                }
                else {
                    yield helpers.ensureLegacyObjectType(client, key, 'hash');
                }
                const res = yield client.query(Array.isArray(key) ? {
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
                return Array.isArray(key) ? res.rows.map((r) => parseFloat(r.v)) : parseFloat(res.rows[0].v);
            }));
        });
    };
    module.incrObjectFieldByBulk = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(data) || !data.length) {
                return;
            }
            // TODO: perf?
            yield Promise.all(data.map((item) => __awaiter(this, void 0, void 0, function* () {
                for (const [field, value] of Object.entries(item[1])) {
                    // eslint-disable-next-line no-await-in-loop
                    yield module.incrObjectFieldBy(item[0], field, value);
                }
            })));
        });
    };
}
exports.default = default_1;
;
