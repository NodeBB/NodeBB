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
    const utils = require('../../../utils');
    module.sortedSetAdd = function (key, score, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            if (Array.isArray(score) && Array.isArray(value)) {
                return yield sortedSetAddBulk(key, score, value);
            }
            if (!utils.isNumber(score)) {
                throw new Error(`[[error:invalid-score, ${score}]]`);
            }
            value = helpers_1.default.valueToString(value);
            score = parseFloat(score);
            yield module.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                yield helpers_1.default.ensureLegacyObjectType(client, key, 'zset');
                yield client.query({
                    name: 'sortedSetAdd',
                    text: `
	INSERT INTO "legacy_zset" ("_key", "value", "score")
	VALUES ($1::TEXT, $2::TEXT, $3::NUMERIC)
	ON CONFLICT ("_key", "value")
	DO UPDATE SET "score" = $3::NUMERIC`,
                    values: [key, value, score],
                });
            }));
        });
    };
    function sortedSetAddBulk(key, scores, values) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!scores.length || !values.length) {
                return;
            }
            if (scores.length !== values.length) {
                throw new Error('[[error:invalid-data]]');
            }
            for (let i = 0; i < scores.length; i += 1) {
                if (!utils.isNumber(scores[i])) {
                    throw new Error(`[[error:invalid-score, ${scores[i]}]]`);
                }
            }
            values = values.map(helpers_1.default.valueToString);
            scores = scores.map(score => parseFloat(score));
            helpers_1.default.removeDuplicateValues(values, scores);
            yield module.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                yield helpers_1.default.ensureLegacyObjectType(client, key, 'zset');
                yield client.query({
                    name: 'sortedSetAddBulk',
                    text: `
INSERT INTO "legacy_zset" ("_key", "value", "score")
SELECT $1::TEXT, v, s
FROM UNNEST($2::TEXT[], $3::NUMERIC[]) vs(v, s)
ON CONFLICT ("_key", "value")
DO UPDATE SET "score" = EXCLUDED."score"`,
                    values: [key, values, scores],
                });
            }));
        });
    }
    module.sortedSetsAdd = function (keys, scores, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return;
            }
            const isArrayOfScores = Array.isArray(scores);
            if ((!isArrayOfScores && !utils.isNumber(scores)) ||
                (isArrayOfScores && scores.map(s => utils.isNumber(s)).includes(false))) {
                throw new Error(`[[error:invalid-score, ${scores}]]`);
            }
            if (isArrayOfScores && scores.length !== keys.length) {
                throw new Error('[[error:invalid-data]]');
            }
            value = helpers_1.default.valueToString(value);
            scores = isArrayOfScores ? scores.map((score) => parseFloat(score)) : parseFloat(scores);
            yield module.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                yield helpers_1.default.ensureLegacyObjectsType(client, keys, 'zset');
                yield client.query({
                    name: isArrayOfScores ? 'sortedSetsAddScores' : 'sortedSetsAdd',
                    text: isArrayOfScores ? `
INSERT INTO "legacy_zset" ("_key", "value", "score")
SELECT k, $2::TEXT, s
FROM UNNEST($1::TEXT[], $3::NUMERIC[]) vs(k, s)
ON CONFLICT ("_key", "value")
	DO UPDATE SET "score" = EXCLUDED."score"` : `
INSERT INTO "legacy_zset" ("_key", "value", "score")
	SELECT k, $2::TEXT, $3::NUMERIC
		FROM UNNEST($1::TEXT[]) k
			ON CONFLICT ("_key", "value")
			DO UPDATE SET "score" = $3::NUMERIC`,
                    values: [keys, value, scores],
                });
            }));
        });
    };
    module.sortedSetAddBulk = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(data) || !data.length) {
                return;
            }
            const keys = [];
            const values = [];
            const scores = [];
            data.forEach((item) => {
                if (!utils.isNumber(item[1])) {
                    throw new Error(`[[error:invalid-score, ${item[1]}]]`);
                }
                keys.push(item[0]);
                scores.push(item[1]);
                values.push(item[2]);
            });
            yield module.transaction((client) => __awaiter(this, void 0, void 0, function* () {
                yield helpers_1.default.ensureLegacyObjectsType(client, keys, 'zset');
                yield client.query({
                    name: 'sortedSetAddBulk2',
                    text: `
INSERT INTO "legacy_zset" ("_key", "value", "score")
SELECT k, v, s
FROM UNNEST($1::TEXT[], $2::TEXT[], $3::NUMERIC[]) vs(k, v, s)
ON CONFLICT ("_key", "value")
DO UPDATE SET "score" = EXCLUDED."score"`,
                    values: [keys, values, scores],
                });
            }));
        });
    };
}
exports.default = default_1;
;
