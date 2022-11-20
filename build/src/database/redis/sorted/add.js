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
const utils = require('../../../utils');
function default_1(module) {
    module.sortedSetAdd = function (key, score, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            if (Array.isArray(score) && Array.isArray(value)) {
                return yield sortedSetAddMulti(key, score, value);
            }
            if (!utils.isNumber(score)) {
                throw new Error(`[[error:invalid-score, ${score}]]`);
            }
            yield module.client.zadd(key, score, String(value));
        });
    };
    function sortedSetAddMulti(key, scores, values) {
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
            const args = [key];
            for (let i = 0; i < scores.length; i += 1) {
                args.push(scores[i], String(values[i]));
            }
            yield module.client.zadd(args);
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
            const batch = module.client.batch();
            for (let i = 0; i < keys.length; i += 1) {
                if (keys[i]) {
                    batch.zadd(keys[i], isArrayOfScores ? scores[i] : scores, String(value));
                }
            }
            yield helpers.execBatch(batch);
        });
    };
    module.sortedSetAddBulk = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(data) || !data.length) {
                return;
            }
            const batch = module.client.batch();
            data.forEach((item) => {
                if (!utils.isNumber(item[1])) {
                    throw new Error(`[[error:invalid-score, ${item[1]}]]`);
                }
                batch.zadd(item[0], item[1], item[2]);
            });
            yield helpers.execBatch(batch);
        });
    };
}
exports.default = default_1;
;
