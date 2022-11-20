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
    module.sortedSetUnionCard = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return 0;
            }
            const res = yield module.pool.query({
                name: 'sortedSetUnionCard',
                text: `
SELECT COUNT(DISTINCT z."value") c
  FROM "legacy_object_live" o
 INNER JOIN "legacy_zset" z
         ON o."_key" = z."_key"
        AND o."type" = z."type"
 WHERE o."_key" = ANY($1::TEXT[])`,
                values: [keys],
            });
            return res.rows[0].c;
        });
    };
    module.getSortedSetUnion = function (params) {
        return __awaiter(this, void 0, void 0, function* () {
            params.sort = 1;
            return yield getSortedSetUnion(params);
        });
    };
    module.getSortedSetRevUnion = function (params) {
        return __awaiter(this, void 0, void 0, function* () {
            params.sort = -1;
            return yield getSortedSetUnion(params);
        });
    };
    function getSortedSetUnion(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { sets } = params;
            const start = params.hasOwnProperty('start') ? params.start : 0;
            const stop = params.hasOwnProperty('stop') ? params.stop : -1;
            let weights = params.weights || [];
            const aggregate = params.aggregate || 'SUM';
            if (sets.length < weights.length) {
                weights = weights.slice(0, sets.length);
            }
            while (sets.length > weights.length) {
                weights.push(1);
            }
            let limit = stop - start + 1;
            if (limit <= 0) {
                limit = null;
            }
            const res = yield module.pool.query({
                name: `getSortedSetUnion${aggregate}${params.sort > 0 ? 'Asc' : 'Desc'}WithScores`,
                text: `
WITH A AS (SELECT z."value",
                  ${aggregate}(z."score" * k."weight") "score"
             FROM UNNEST($1::TEXT[], $2::NUMERIC[]) k("_key", "weight")
            INNER JOIN "legacy_object_live" o
                    ON o."_key" = k."_key"
            INNER JOIN "legacy_zset" z
                    ON o."_key" = z."_key"
                   AND o."type" = z."type"
            GROUP BY z."value")
SELECT A."value",
       A."score"
  FROM A
 ORDER BY A."score" ${params.sort > 0 ? 'ASC' : 'DESC'}
 LIMIT $4::INTEGER
OFFSET $3::INTEGER`,
                values: [sets, weights, start, limit],
            });
            if (params.withScores) {
                res.rows = res.rows.map((r) => ({
                    value: r.value,
                    score: parseFloat(r.score),
                }));
            }
            else {
                res.rows = res.rows.map((r) => r.value);
            }
            return res.rows;
        });
    }
}
exports.default = default_1;
;
