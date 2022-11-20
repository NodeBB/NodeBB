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
            if (!isValueArray) {
                value = [value];
            }
            if (Array.isArray(key)) {
                const batch = module.client.batch();
                key.forEach(k => batch.zrem(k, value));
                yield helpers_1.default.execBatch(batch);
            }
            else {
                yield module.client.zrem(key, value);
            }
        });
    };
    module.sortedSetsRemove = function (keys, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.sortedSetRemove(keys, value);
        });
    };
    module.sortedSetsRemoveRangeByScore = function (keys, min, max) {
        return __awaiter(this, void 0, void 0, function* () {
            const batch = module.client.batch();
            keys.forEach(k => batch.zremrangebyscore(k, min, max));
            yield helpers_1.default.execBatch(batch);
        });
    };
    module.sortedSetRemoveBulk = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(data) || !data.length) {
                return;
            }
            const batch = module.client.batch();
            data.forEach((item) => batch.zrem(item[0], item[1]));
            yield helpers_1.default.execBatch(batch);
        });
    };
}
exports.default = default_1;
;
