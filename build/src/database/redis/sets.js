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
    module.setAdd = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(value)) {
                value = [value];
            }
            if (!value.length) {
                return;
            }
            yield module.client.sadd(key, value);
        });
    };
    module.setsAdd = function (keys, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return;
            }
            const batch = module.client.batch();
            keys.forEach(k => batch.sadd(String(k), String(value)));
            yield helpers.execBatch(batch);
        });
    };
    module.setRemove = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(value)) {
                value = [value];
            }
            if (!Array.isArray(key)) {
                key = [key];
            }
            if (!value.length) {
                return;
            }
            const batch = module.client.batch();
            key.forEach(k => batch.srem(String(k), value));
            yield helpers.execBatch(batch);
        });
    };
    module.setsRemove = function (keys, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const batch = module.client.batch();
            keys.forEach(k => batch.srem(String(k), value));
            yield helpers.execBatch(batch);
        });
    };
    module.isSetMember = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield module.client.sismember(key, value);
            return result === 1;
        });
    };
    module.isSetMembers = function (key, values) {
        return __awaiter(this, void 0, void 0, function* () {
            const batch = module.client.batch();
            values.forEach(v => batch.sismember(String(key), String(v)));
            const results = yield helpers.execBatch(batch);
            return results ? helpers.resultsToBool(results) : null;
        });
    };
    module.isMemberOfSets = function (sets, value) {
        return __awaiter(this, void 0, void 0, function* () {
            const batch = module.client.batch();
            sets.forEach(s => batch.sismember(String(s), String(value)));
            const results = yield helpers.execBatch(batch);
            return results ? helpers.resultsToBool(results) : null;
        });
    };
    module.getSetMembers = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.client.smembers(key);
        });
    };
    module.getSetsMembers = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            const batch = module.client.batch();
            keys.forEach(k => batch.smembers(String(k)));
            return yield helpers.execBatch(batch);
        });
    };
    module.setCount = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.client.scard(key);
        });
    };
    module.setsCount = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            const batch = module.client.batch();
            keys.forEach(k => batch.scard(String(k)));
            return yield helpers.execBatch(batch);
        });
    };
    module.setRemoveRandom = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.client.spop(key);
        });
    };
    return module;
}
exports.default = default_1;
;
