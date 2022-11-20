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
            try {
                yield module.client.collection('objects').updateOne({ _key: key, value: value }, { $set: { score: parseFloat(score) } }, { upsert: true });
            }
            catch (err) {
                if (err && err.message.startsWith('E11000 duplicate key error')) {
                    return yield module.sortedSetAdd(key, score, value);
                }
                throw err;
            }
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
            const bulk = module.client.collection('objects').initializeUnorderedBulkOp();
            for (let i = 0; i < scores.length; i += 1) {
                bulk.find({ _key: key, value: values[i] }).upsert().updateOne({ $set: { score: parseFloat(scores[i]) } });
            }
            yield bulk.execute();
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
            const bulk = module.client.collection('objects').initializeUnorderedBulkOp();
            for (let i = 0; i < keys.length; i += 1) {
                bulk
                    .find({ _key: keys[i], value: value })
                    .upsert()
                    .updateOne({ $set: { score: parseFloat(isArrayOfScores ? scores[i] : scores) } });
            }
            yield bulk.execute();
        });
    };
    module.sortedSetAddBulk = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(data) || !data.length) {
                return;
            }
            const bulk = module.client.collection('objects').initializeUnorderedBulkOp();
            data.forEach((item) => {
                if (!utils.isNumber(item[1])) {
                    throw new Error(`[[error:invalid-score, ${item[1]}]]`);
                }
                bulk.find({ _key: item[0], value: String(item[2]) }).upsert().updateOne({ $set: { score: parseFloat(item[1]) } });
            });
            yield bulk.execute();
        });
    };
}
exports.default = default_1;
;
