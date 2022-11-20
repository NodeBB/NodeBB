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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = __importDefault(require("../helpers"));
function default_1(module) {
    module.sortedSetRemove = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            const isValueArray = Array.isArray(value);
            if (!value || (isValueArray && !value.length)) {
                return;
            }
            if (!Array.isArray(key)) {
                key = [key];
            }
            if (!isValueArray) {
                value = [value];
            }
            value = value.map(helpers_1.default.valueToString);
            yield module.pool.query({
                name: 'sortedSetRemove',
                text: `
DELETE FROM "legacy_zset"
 WHERE "_key" = ANY($1::TEXT[])
   AND "value" = ANY($2::TEXT[])`,
                values: [key, value],
            });
        });
    };
    module.sortedSetsRemove = function (keys, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return;
            }
            value = helpers_1.default.valueToString(value);
            yield module.pool.query({
                name: 'sortedSetsRemove',
                text: `
DELETE FROM "legacy_zset"
 WHERE "_key" = ANY($1::TEXT[])
   AND "value" = $2::TEXT`,
                values: [keys, value],
            });
        });
    };
    module.sortedSetsRemoveRangeByScore = function (keys, min, max) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return;
            }
            if (min === '-inf') {
                min = null;
            }
            if (max === '+inf') {
                max = null;
            }
            yield module.pool.query({
                name: 'sortedSetsRemoveRangeByScore',
                text: `
DELETE FROM "legacy_zset"
 WHERE "_key" = ANY($1::TEXT[])
   AND ("score" >= $2::NUMERIC OR $2::NUMERIC IS NULL)
   AND ("score" <= $3::NUMERIC OR $3::NUMERIC IS NULL)`,
                values: [keys, min, max],
            });
        });
    };
    module.sortedSetRemoveBulk = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(data) || !data.length) {
                return;
            }
            const keys = data.map((d) => d[0]);
            const values = data.map((d) => d[1]);
            yield module.pool.query({
                name: 'sortedSetRemoveBulk',
                text: `
	DELETE FROM "legacy_zset"
	WHERE (_key, value) IN (
		SELECT k, v
		FROM UNNEST($1::TEXT[], $2::TEXT[]) vs(k, v)
		)`,
                values: [keys, values],
            });
        });
    };
}
exports.default = default_1;
;
