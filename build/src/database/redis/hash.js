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
    const cache = require('../cache').default('redis');
    module.objectCache = cache;
    module.setObject = function (key, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key || !data) {
                return;
            }
            if (data.hasOwnProperty('')) {
                delete data[''];
            }
            Object.keys(data).forEach((key) => {
                if (data[key] === undefined || data[key] === null) {
                    delete data[key];
                }
            });
            if (!Object.keys(data).length) {
                return;
            }
            if (Array.isArray(key)) {
                const batch = module.client.batch();
                key.forEach(k => batch.hmset(k, data));
                yield helpers.execBatch(batch);
            }
            else {
                yield module.client.hmset(key, data);
            }
            cache.del(key);
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
            const batch = module.client.batch();
            data.forEach((item) => {
                if (Object.keys(item[1]).length) {
                    batch.hmset(item[0], item[1]);
                }
            });
            yield helpers.execBatch(batch);
            cache.del(data.map((item) => item[0]));
        });
    };
    module.setObjectField = function (key, field, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!field) {
                return;
            }
            if (Array.isArray(key)) {
                const batch = module.client.batch();
                key.forEach(k => batch.hset(k, field, value));
                yield helpers.execBatch(batch);
            }
            else {
                yield module.client.hset(key, field, value);
            }
            cache.del(key);
        });
    };
    module.getObject = function (key, fields = []) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return null;
            }
            const data = yield module.getObjectsFields([key], fields);
            return data && data.length ? data[0] : null;
        });
    };
    module.getObjects = function (keys, fields = []) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.getObjectsFields(keys, fields);
        });
    };
    module.getObjectField = function (key, field) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return null;
            }
            const cachedData = {};
            cache.getUnCachedKeys([key], cachedData);
            if (cachedData[key]) {
                return cachedData[key].hasOwnProperty(field) ? cachedData[key][field] : null;
            }
            return yield module.client.hget(key, String(field));
        });
    };
    module.getObjectFields = function (key, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return null;
            }
            const results = yield module.getObjectsFields([key], fields);
            return results ? results[0] : null;
        });
    };
    module.getObjectsFields = function (keys, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return [];
            }
            const cachedData = {};
            const unCachedKeys = cache.getUnCachedKeys(keys, cachedData);
            let data = [];
            if (unCachedKeys.length > 1) {
                const batch = module.client.batch();
                unCachedKeys.forEach(k => batch.hgetall(k));
                data = yield helpers.execBatch(batch);
            }
            else if (unCachedKeys.length === 1) {
                data = [yield module.client.hgetall(unCachedKeys[0])];
            }
            // convert empty objects into null for back-compat with node_redis
            data = data.map((elem) => {
                if (!Object.keys(elem).length) {
                    return null;
                }
                return elem;
            });
            unCachedKeys.forEach((key, i) => {
                cachedData[key] = data[i] || null;
                cache.set(key, cachedData[key]);
            });
            if (!Array.isArray(fields) || !fields.length) {
                return keys.map(key => (cachedData[key] ? Object.assign({}, cachedData[key]) : null));
            }
            return keys.map((key) => {
                const item = cachedData[key] || {};
                const result = {};
                fields.forEach((field) => {
                    result[field] = item[field] !== undefined ? item[field] : null;
                });
                return result;
            });
        });
    };
    module.getObjectKeys = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.client.hkeys(key);
        });
    };
    module.getObjectValues = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.client.hvals(key);
        });
    };
    module.isObjectField = function (key, field) {
        return __awaiter(this, void 0, void 0, function* () {
            const exists = yield module.client.hexists(key, field);
            return exists === 1;
        });
    };
    module.isObjectFields = function (key, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            const batch = module.client.batch();
            fields.forEach(f => batch.hexists(String(key), String(f)));
            const results = yield helpers.execBatch(batch);
            return Array.isArray(results) ? helpers.resultsToBool(results) : null;
        });
    };
    module.deleteObjectField = function (key, field) {
        return __awaiter(this, void 0, void 0, function* () {
            if (key === undefined || key === null || field === undefined || field === null) {
                return;
            }
            yield module.client.hdel(key, field);
            cache.del(key);
        });
    };
    module.deleteObjectFields = function (key, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key || (Array.isArray(key) && !key.length) || !Array.isArray(fields) || !fields.length) {
                return;
            }
            fields = fields.filter(Boolean);
            if (!fields.length) {
                return;
            }
            if (Array.isArray(key)) {
                const batch = module.client.batch();
                key.forEach(k => batch.hdel(k, fields));
                yield helpers.execBatch(batch);
            }
            else {
                yield module.client.hdel(key, fields);
            }
            cache.del(key);
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
            let result;
            if (Array.isArray(key)) {
                const batch = module.client.batch();
                key.forEach(k => batch.hincrby(k, field, value));
                result = yield helpers.execBatch(batch);
            }
            else {
                result = yield module.client.hincrby(key, field, value);
            }
            cache.del(key);
            return Array.isArray(result) ? result.map(value => parseInt(value, 10)) : parseInt(result, 10);
        });
    };
    module.incrObjectFieldByBulk = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(data) || !data.length) {
                return;
            }
            const batch = module.client.batch();
            data.forEach((item) => {
                for (const [field, value] of Object.entries(item[1])) {
                    batch.hincrby(item[0], field, value);
                }
            });
            yield helpers.execBatch(batch);
            cache.del(data.map((item) => item[0]));
        });
    };
}
exports.default = default_1;
;
