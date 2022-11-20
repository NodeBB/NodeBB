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
    const helpers = require('./helpers').default;
    const cache = require('../cache').default('mongo');
    module.objectCache = cache;
    module.setObject = function (key, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const isArray = Array.isArray(key);
            if (!key || !data || (isArray && !key.length)) {
                return;
            }
            const writeData = helpers.serializeData(data);
            if (!Object.keys(writeData).length) {
                return;
            }
            try {
                if (isArray) {
                    const bulk = module.client.collection('objects').initializeUnorderedBulkOp();
                    key.forEach(key => bulk.find({ _key: key }).upsert().updateOne({ $set: writeData }));
                    yield bulk.execute();
                }
                else {
                    yield module.client.collection('objects').updateOne({ _key: key }, { $set: writeData }, { upsert: true });
                }
            }
            catch (err) {
                if (err && err.message.startsWith('E11000 duplicate key error')) {
                    return yield module.setObject(key, data);
                }
                throw err;
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
            try {
                let bulk;
                data.forEach((item) => {
                    const writeData = helpers.serializeData(item[1]);
                    if (Object.keys(writeData).length) {
                        if (!bulk) {
                            bulk = module.client.collection('objects').initializeUnorderedBulkOp();
                        }
                        bulk.find({ _key: item[0] }).upsert().updateOne({ $set: writeData });
                    }
                });
                if (bulk) {
                    yield bulk.execute();
                }
            }
            catch (err) {
                if (err && err.message.startsWith('E11000 duplicate key error')) {
                    return yield module.setObjectBulk(data);
                }
                throw err;
            }
            cache.del(data.map((item) => item[0]));
        });
    };
    module.setObjectField = function (key, field, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!field) {
                return;
            }
            const data = {};
            data[field] = value;
            yield module.setObject(key, data);
        });
    };
    module.getObject = function (key, fields = []) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return null;
            }
            const data = yield module.getObjects([key], fields);
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
            field = helpers.fieldToString(field);
            const item = yield module.client.collection('objects').findOne({ _key: key }, { projection: { _id: 0, [field]: 1 } });
            if (!item) {
                return null;
            }
            return item.hasOwnProperty(field) ? item[field] : null;
        });
    };
    module.getObjectFields = function (key, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return null;
            }
            const data = yield module.getObjectsFields([key], fields);
            return data ? data[0] : null;
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
            if (unCachedKeys.length >= 1) {
                data = yield module.client.collection('objects').find({ _key: unCachedKeys.length === 1 ? unCachedKeys[0] : { $in: unCachedKeys } }, { projection: { _id: 0 } }).toArray();
                data = data.map(helpers.deserializeData);
            }
            const map = helpers.toMap(data);
            unCachedKeys.forEach((key) => {
                cachedData[key] = map[key] || null;
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
            const data = yield module.getObject(key);
            return data ? Object.keys(data) : [];
        });
    };
    module.getObjectValues = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield module.getObject(key);
            return data ? Object.values(data) : [];
        });
    };
    module.isObjectField = function (key, field) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield module.isObjectFields(key, [field]);
            return Array.isArray(data) && data.length ? data[0] : false;
        });
    };
    module.isObjectFields = function (key, fields) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return;
            }
            const data = {};
            fields.forEach((field) => {
                field = helpers.fieldToString(field);
                if (field) {
                    data[field] = 1;
                }
            });
            const item = yield module.client.collection('objects').findOne({ _key: key }, { projection: data });
            const results = fields.map(f => !!item && item[f] !== undefined && item[f] !== null);
            return results;
        });
    };
    module.deleteObjectField = function (key, field) {
        return __awaiter(this, void 0, void 0, function* () {
            yield module.deleteObjectFields(key, [field]);
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
            const data = {};
            fields.forEach((field) => {
                field = helpers.fieldToString(field);
                data[field] = '';
            });
            if (Array.isArray(key)) {
                yield module.client.collection('objects').updateMany({ _key: { $in: key } }, { $unset: data });
            }
            else {
                yield module.client.collection('objects').updateOne({ _key: key }, { $unset: data });
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
            const increment = {};
            field = helpers.fieldToString(field);
            increment[field] = value;
            if (Array.isArray(key)) {
                const bulk = module.client.collection('objects').initializeUnorderedBulkOp();
                key.forEach((key) => {
                    bulk.find({ _key: key }).upsert().update({ $inc: increment });
                });
                yield bulk.execute();
                cache.del(key);
                const result = yield module.getObjectsFields(key, [field]);
                return result.map(data => data && data[field]);
            }
            try {
                const result = yield module.client.collection('objects').findOneAndUpdate({
                    _key: key,
                }, {
                    $inc: increment,
                }, {
                    returnDocument: 'after',
                    upsert: true,
                });
                cache.del(key);
                return result && result.value ? result.value[field] : null;
            }
            catch (err) {
                // if there is duplicate key error retry the upsert
                // https://github.com/NodeBB/NodeBB/issues/4467
                // https://jira.mongodb.org/browse/SERVER-14322
                // https://docs.mongodb.org/manual/reference/command/findAndModify/#upsert-and-unique-index
                if (err && err.message.startsWith('E11000 duplicate key error')) {
                    return yield module.incrObjectFieldBy(key, field, value);
                }
                throw err;
            }
        });
    };
    module.incrObjectFieldByBulk = function (data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(data) || !data.length) {
                return;
            }
            const bulk = module.client.collection('objects').initializeUnorderedBulkOp();
            data.forEach((item) => {
                const increment = {};
                for (const [field, value] of Object.entries(item[1])) {
                    increment[helpers.fieldToString(field)] = value;
                }
                bulk.find({ _key: item[0] }).upsert().update({ $inc: increment });
            });
            yield bulk.execute();
            cache.del(data.map((item) => item[0]));
        });
    };
}
exports.default = default_1;
;
