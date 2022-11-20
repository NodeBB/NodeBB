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
            if (isValueArray) {
                value = value.map(helpers_1.default.valueToString);
            }
            else {
                value = helpers_1.default.valueToString(value);
            }
            yield module.client.collection('objects').deleteMany({
                _key: Array.isArray(key) ? { $in: key } : key,
                value: isValueArray ? { $in: value } : value,
            });
        });
    };
    module.sortedSetsRemove = function (keys, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return;
            }
            value = helpers_1.default.valueToString(value);
            yield module.client.collection('objects').deleteMany({ _key: { $in: keys }, value: value });
        });
    };
    module.sortedSetsRemoveRangeByScore = function (keys, min, max) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return;
            }
            const query = { _key: { $in: keys } };
            if (keys.length === 1) {
                query._key = keys[0];
            }
            if (min !== '-inf') {
                query.score = { $gte: parseFloat(min) };
            }
            if (max !== '+inf') {
                query.score = query.score || {};
                query.score.$lte = parseFloat(max);
            }
            yield module.client.collection('objects').deleteMany(query);
        });
    };
    module.sortedSetRemoveBulk = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(data) || !data.length) {
                return;
            }
            const bulk = module.client.collection('objects').initializeUnorderedBulkOp();
            data.forEach((item) => bulk.find({ _key: item[0], value: String(item[1]) }).delete());
            yield bulk.execute();
        });
    };
}
exports.default = default_1;
;
