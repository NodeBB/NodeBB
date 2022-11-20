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
            yield module.client.dropDatabase();
        });
    };
    module.emptydb = function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.client.collection('objects').deleteMany({});
            module.objectCache.reset();
        });
    };
    module.exists = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            if (Array.isArray(key)) {
                const data = yield module.client.collection('objects').find({
                    _key: { $in: key },
                }, { _id: 0, _key: 1 }).toArray();
                const map = {};
                data.forEach((item) => {
                    map[item._key] = true;
                });
                return key.map(key => !!map[key]);
            }
            const item = yield module.client.collection('objects').findOne({
                _key: key,
            }, { _id: 0, _key: 1 });
            return item !== undefined && item !== null;
        });
    };
    module.scan = function (params) {
        return __awaiter(this, void 0, void 0, function* () {
            const match = helpers.buildMatchQuery(params.match);
            return yield module.client.collection('objects').distinct('_key', { _key: { $regex: new RegExp(match) } });
        });
    };
    module.delete = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            yield module.client.collection('objects').deleteMany({ _key: key });
            module.objectCache.del(key);
        });
    };
    module.deleteAll = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return;
            }
            yield module.client.collection('objects').deleteMany({ _key: { $in: keys } });
            module.objectCache.del(keys);
        });
    };
    module.get = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            const objectData = yield module.client.collection('objects').findOne({ _key: key }, { projection: { _id: 0 } });
            // fallback to old field name 'value' for backwards compatibility #6340
            let value = null;
            if (objectData) {
                if (objectData.hasOwnProperty('data')) {
                    value = objectData.data;
                }
                else if (objectData.hasOwnProperty('value')) {
                    value = objectData.value;
                }
            }
            return value;
        });
    };
    module.set = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            yield module.setObject(key, { data: value });
        });
    };
    module.increment = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            const result = yield module.client.collection('objects').findOneAndUpdate({
                _key: key,
            }, {
                $inc: { data: 1 },
            }, {
                returnDocument: 'after',
                upsert: true,
            });
            return result && result.value ? result.value.data : null;
        });
    };
    module.rename = function (oldKey, newKey) {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.client.collection('objects').updateMany({ _key: oldKey }, { $set: { _key: newKey } });
            module.objectCache.del([oldKey, newKey]);
        });
    };
    module.type = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield module.client.collection('objects').findOne({ _key: key });
            if (!data) {
                return null;
            }
            delete data.expireAt;
            const keys = Object.keys(data);
            if (keys.length === 4 && data.hasOwnProperty('_key') && data.hasOwnProperty('score') && data.hasOwnProperty('value')) {
                return 'zset';
            }
            else if (keys.length === 3 && data.hasOwnProperty('_key') && data.hasOwnProperty('members')) {
                return 'set';
            }
            else if (keys.length === 3 && data.hasOwnProperty('_key') && data.hasOwnProperty('array')) {
                return 'list';
            }
            else if (keys.length === 3 && data.hasOwnProperty('_key') && data.hasOwnProperty('data')) {
                return 'string';
            }
            return 'hash';
        });
    };
    module.expire = function (key, seconds) {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.expireAt(key, Math.round(Date.now() / 1000) + seconds);
        });
    };
    module.expireAt = function (key, timestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.setObjectField(key, 'expireAt', new Date(timestamp * 1000));
        });
    };
    module.pexpire = function (key, ms) {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.pexpireAt(key, Date.now() + parseInt(ms, 10));
        });
    };
    module.pexpireAt = function (key, timestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            timestamp = Math.min(timestamp, 8640000000000000);
            yield module.setObjectField(key, 'expireAt', new Date(timestamp));
        });
    };
    module.ttl = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return Math.round(((yield module.getObjectField(key, 'expireAt')) - Date.now()) / 1000);
        });
    };
    module.pttl = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield module.getObjectField(key, 'expireAt')) - Date.now();
        });
    };
}
exports.default = default_1;
;
