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
    const _ = require('lodash');
    const helpers = require('./helpers').defualt;
    module.setAdd = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(value)) {
                value = [value];
            }
            if (!value.length) {
                return;
            }
            value = value.map(v => helpers.valueToString(v));
            yield module.client.collection('objects').updateOne({
                _key: key,
            }, {
                $addToSet: {
                    members: {
                        $each: value,
                    },
                },
            }, {
                upsert: true,
            });
        });
    };
    module.setsAdd = function (keys, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return;
            }
            if (!Array.isArray(value)) {
                value = [value];
            }
            value = value.map(v => helpers.valueToString(v));
            const bulk = module.client.collection('objects').initializeUnorderedBulkOp();
            for (let i = 0; i < keys.length; i += 1) {
                bulk.find({ _key: keys[i] }).upsert().updateOne({
                    $addToSet: {
                        members: {
                            $each: value,
                        },
                    },
                });
            }
            try {
                yield bulk.execute();
            }
            catch (err) {
                if (err && err.message.startsWith('E11000 duplicate key error')) {
                    return yield module.setsAdd(keys, value);
                }
                throw err;
            }
        });
    };
    module.setRemove = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(value)) {
                value = [value];
            }
            value = value.map(v => helpers.valueToString(v));
            yield module.client.collection('objects').updateMany({
                _key: Array.isArray(key) ? { $in: key } : key,
            }, {
                $pullAll: { members: value },
            });
        });
    };
    module.setsRemove = function (keys, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return;
            }
            value = helpers.valueToString(value);
            yield module.client.collection('objects').updateMany({
                _key: { $in: keys },
            }, {
                $pull: { members: value },
            });
        });
    };
    module.isSetMember = function (key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return false;
            }
            value = helpers.valueToString(value);
            const item = yield module.client.collection('objects').findOne({
                _key: key, members: value,
            }, {
                projection: { _id: 0, members: 0 },
            });
            return item !== null && item !== undefined;
        });
    };
    module.isSetMembers = function (key, values) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key || !Array.isArray(values) || !values.length) {
                return [];
            }
            values = values.map(v => helpers.valueToString(v));
            const result = yield module.client.collection('objects').findOne({
                _key: key,
            }, {
                projection: { _id: 0, _key: 0 },
            });
            const membersSet = new Set(result && Array.isArray(result.members) ? result.members : []);
            return values.map(v => membersSet.has(v));
        });
    };
    module.isMemberOfSets = function (sets, value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(sets) || !sets.length) {
                return [];
            }
            value = helpers.valueToString(value);
            const result = yield module.client.collection('objects').find({
                _key: { $in: sets }, members: value,
            }, {
                projection: { _id: 0, members: 0 },
            }).toArray();
            const map = {};
            result.forEach((item) => {
                map[item._key] = true;
            });
            return sets.map((set) => !!map[set]);
        });
    };
    module.getSetMembers = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return [];
            }
            const data = yield module.client.collection('objects').findOne({
                _key: key,
            }, {
                projection: { _id: 0, _key: 0 },
            });
            return data ? data.members : [];
        });
    };
    module.getSetsMembers = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Array.isArray(keys) || !keys.length) {
                return [];
            }
            const data = yield module.client.collection('objects').find({
                _key: { $in: keys },
            }, {
                projection: { _id: 0 },
            }).toArray();
            const sets = {};
            data.forEach((set) => {
                sets[set._key] = set.members || [];
            });
            return keys.map(k => sets[k] || []);
        });
    };
    module.setCount = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!key) {
                return 0;
            }
            const data = yield module.client.collection('objects').aggregate([
                { $match: { _key: key } },
                { $project: { _id: 0, count: { $size: '$members' } } },
            ]).toArray();
            return Array.isArray(data) && data.length ? data[0].count : 0;
        });
    };
    module.setsCount = function (keys) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield module.client.collection('objects').aggregate([
                { $match: { _key: { $in: keys } } },
                { $project: { _id: 0, _key: 1, count: { $size: '$members' } } },
            ]).toArray();
            const map = _.keyBy(data, '_key');
            return keys.map((key) => (map.hasOwnProperty(key) ? map[key].count : 0));
        });
    };
    module.setRemoveRandom = function (key) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = yield module.client.collection('objects').findOne({ _key: key });
            if (!data) {
                return;
            }
            const randomIndex = Math.floor(Math.random() * data.members.length);
            const value = data.members[randomIndex];
            yield module.setRemove(data._key, value);
            return value;
        });
    };
}
exports.default = default_1;
;
