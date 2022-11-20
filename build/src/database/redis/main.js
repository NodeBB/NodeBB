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
    module.flushdb = function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.client.send_command('flushdb', []);
        });
    };
    module.emptydb = function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.flushdb();
            module.objectCache.reset();
        });
    };
    module.exists = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (Array.isArray(key)) {
                const batch = module.client.batch();
                key.forEach(key => batch.exists(key));
                const data = yield helpers.execBatch(batch);
                return data.map(exists => exists === 1);
            }
            const exists = yield module.client.exists(key);
            return exists === 1;
        });
    };
    module.scan = function (params) {
        return __awaiter(this, void 0, void 0, function* () {
            let cursor = '0';
            let returnData = [];
            const seen = {};
            do {
                /* eslint-disable no-await-in-loop */
                const res = yield module.client.scan(cursor, 'MATCH', params.match, 'COUNT', 10000);
                cursor = res[0];
                const values = res[1].filter((value) => {
                    const isSeen = !!seen[value];
                    if (!isSeen) {
                        seen[value] = 1;
                    }
                    return !isSeen;
                });
                returnData = returnData.concat(values);
            } while (cursor !== '0');
            return returnData;
        });
    };
    module.delete = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.client.del(key);
            module.objectCache.del(key);
        });
    };
    module.deleteAll = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return;
            }
            yield module.client.del(keys);
            module.objectCache.del(keys);
        });
    };
    module.get = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.client.get(key);
        });
    };
    module.set = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.client.set(key, value);
        });
    };
    module.increment = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.client.incr(key);
        });
    };
    module.rename = function (oldKey, newKey) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield module.client.rename(oldKey, newKey);
            }
            catch (err) {
                if (err && err.message !== 'ERR no such key') {
                    throw err;
                }
            }
            module.objectCache.del([oldKey, newKey]);
        });
    };
    module.type = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            const type = yield module.client.type(key);
            return type !== 'none' ? type : null;
        });
    };
    module.expire = function (key, seconds) {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.client.expire(key, seconds);
        });
    };
    module.expireAt = function (key, timestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.client.expireat(key, timestamp);
        });
    };
    module.pexpire = function (key, ms) {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.client.pexpire(key, ms);
        });
    };
    module.pexpireAt = function (key, timestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.client.pexpireat(key, timestamp);
        });
    };
    module.ttl = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.client.ttl(key);
        });
    };
    module.pttl = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield module.client.pttl(key);
        });
    };
}
exports.default = default_1;
;
